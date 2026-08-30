"""
Resolves which CCTV clip(s) belong to an incident.

The link already exists in the database and is **alert-level**:

    raw_alerts.video_id  ->  videos.id

which is more precise than matching on location: two alerts in the same lane at
the same minute can point at different cameras. An incident inherits the union
of its member alerts' clips, so an incident whose alerts reference two cameras
gets both analysed.

`videos` columns actually present: id, filename, storage_path, public_url,
size_bytes, mime_type, metadata, created_at, description.

FOOTAGE_RULES below is a secondary, location-based fallback for alerts that have
no `video_id` set. It is empty by default.

Everything here fails soft: no `videos` table, no link, or a lookup error all
resolve to "no footage", the video analyst is skipped, and the orchestrator
decides on telemetry alone. Footage is an input, never a requirement.
"""

from __future__ import annotations

import logging
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent
MCP_DIR = BACKEND_DIR / "mcp"
if str(MCP_DIR) not in sys.path:
    sys.path.insert(0, str(MCP_DIR))

logger = logging.getLogger("psa_agent.cctv")

VIDEOS_TABLE = "videos"

# Where a relative storage_path is resolved from, when a clip is on disk rather
# than behind a public URL. Override with CCTV_ROOT.
CCTV_ROOT = Path(os.getenv("CCTV_ROOT", str(BACKEND_DIR / "video")))


@dataclass(frozen=True)
class Footage:
    video_id: str
    uri: str                       # public_url, or a path resolved under CCTV_ROOT
    filename: str = ""             # NOT shown to the model — see note below
    description: str = ""          # NOT shown to the model — see note below
    location: str = ""             # raw DB spelling, e.g. "Lane_7"
    alert_ids: tuple[str, ...] = field(default_factory=tuple)

    @property
    def is_remote(self) -> bool:
        return self.uri.startswith(("http://", "https://"))

    def local_path(self) -> Optional[Path]:
        """The on-disk file for a non-remote uri, or None if it is not there."""
        if self.is_remote:
            return None
        candidate = Path(self.uri)
        if not candidate.is_absolute():
            candidate = CCTV_ROOT / candidate
        return candidate if candidate.exists() else None


# ---------------------------------------------------------------------------
# NOTE ON FILENAMES — the same leak as raw_alerts.message
#
# The seeded clips are named `lane_block_byobject.mp4`, `agv_halfway_down.mp4`,
# `electricty_faulty.mp4`. Those names state the answer. Handing them to the
# vision model would mean it "finds" a blocked lane because it was told the file
# was called that, exactly the problem `message` had.
#
# So `filename` and `description` are carried on Footage for the docket, the UI
# and for humans — and are deliberately NOT passed into the analysis prompt.
# video_analyst.build_prompt() takes the location and nothing else.
# ---------------------------------------------------------------------------

# Optional location-based fallback for alerts with no video_id. Same shape as
# above; `location` is matched against the incident's location.
FOOTAGE_RULES: list[Footage] = []


def _normalise(value: Optional[str]) -> str:
    return str(value or "").strip().lower().replace("-", "_")


def load_videos() -> dict[str, dict[str, Any]]:
    """Every row in `videos`, keyed by id. Empty dict if the table is absent."""
    try:
        from supabase_client import get_supabase_client

        rows = get_supabase_client().table(VIDEOS_TABLE).select("*").execute().data or []
    except Exception as exc:
        logger.debug("No %s table available (%s)", VIDEOS_TABLE, exc)
        return {}
    return {str(r["id"]): r for r in rows if r.get("id")}


def _to_footage(
    row: dict[str, Any], location: str, alert_ids: Iterable[str]
) -> Optional[Footage]:
    # public_url first: it is directly fetchable, and the local_path in
    # `metadata` points at whichever machine did the upload, not at this one.
    uri = row.get("public_url") or row.get("storage_path") or ""
    if not uri:
        local = (row.get("metadata") or {}).get("local_path")
        uri = local or ""
    if not uri:
        return None
    return Footage(
        video_id=str(row["id"]),
        uri=str(uri),
        filename=str(row.get("filename") or ""),
        description=str(row.get("description") or ""),
        location=location,
        alert_ids=tuple(alert_ids),
    )


def resolve_footage_for_incident(
    cluster: dict[str, Any],
    videos_by_id: Optional[dict[str, dict[str, Any]]] = None,
) -> list[Footage]:
    """
    All distinct clips referenced by an incident's member alerts.

    `cluster["video_links"]` is {video_id: [alert_id, ...]}, attached by
    stage1_pipeline.to_graph_clusters() from the raw rows it already has.
    Falls back to FOOTAGE_RULES matched on location when there are no links.
    """
    location = str(cluster.get("target_entity") or "")
    links: dict[str, list[str]] = cluster.get("video_links") or {}

    if links:
        catalogue = videos_by_id if videos_by_id is not None else load_videos()
        out: list[Footage] = []
        for video_id, alert_ids in sorted(links.items()):
            row = catalogue.get(video_id)
            if not row:
                logger.warning("Alerts %s reference unknown video %s", alert_ids, video_id)
                continue
            footage = _to_footage(row, location, alert_ids)
            if footage:
                out.append(footage)
        if out:
            return out

    loc = _normalise(location)
    return [rule for rule in FOOTAGE_RULES if _normalise(rule.location) == loc][:1]


def footage_evidence_ref(footage: Footage) -> dict[str, Any]:
    """The evidenceRefs entry for a clip, matching the shape Stage 1 emits."""
    return {
        "type": "cctv_footage",
        "videoId": footage.video_id,
        "uri": footage.uri,
        "filename": footage.filename,
        "description": footage.description,
        "zoneId": footage.location,
        "sourceAlertIds": list(footage.alert_ids),
    }
