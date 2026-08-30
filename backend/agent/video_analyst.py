"""
Video Analyst — Gemini 3.7 Flash over the mock CCTV clip attached to an incident.

Runs BEFORE the orchestrator, so what the camera saw is one of the inputs to the
routing decision rather than something an investigator discovers later.

Two deliberate constraints on the prompt:

  * It is told the location and nothing else. Not the fault type, not the alert
    types, not the clip's own description. A model told "this is a twistlock
    failure" will report a twistlock failure; the point of this node is an
    independent observation the orchestrator can weigh against the telemetry.
  * It must answer in the JSON contract below. The orchestrator parses it, so a
    prose answer is useless.

Failure is not fatal anywhere: a missing API key, an unreachable file, an upload
timeout or a malformed response all resolve to "no video finding", and the
pipeline continues on telemetry alone.
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from typing import Any, Optional
from urllib.request import urlopen

from agent.cctv import Footage

logger = logging.getLogger("psa_agent.video")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
UPLOAD_TIMEOUT_S = float(os.getenv("VIDEO_UPLOAD_TIMEOUT_S", "120"))

# The JSON the orchestrator expects back. Stated in the prompt AND enforced by
# response_schema — the prompt so the contract is legible to anyone reading it,
# the schema so a chatty model still produces parseable output.
VIDEO_FINDING_CONTRACT = """{
  "assessment": "CONFIRMED_INCIDENT" | "POTENTIAL_HAZARD" | "NORMAL_ACTIVITY" | "UNUSABLE_FOOTAGE",
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE",
  "confidence": 0.0-1.0,
  "summary": "one or two sentences: what the footage shows",
  "observations": [
    {
      "timestamp": "MM:SS-MM:SS",
      "what_happens": "plain description of the event",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "entities": ["what is involved: vehicles, machinery, people, environment"]
    }
  ],
  "entities_involved": ["distinct entities visible across the whole clip"],
  "visual_cues": ["concrete things a person could verify by watching, e.g. 'container tilted ~15 degrees'"]
}"""

RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "assessment": {
            "type": "string",
            "enum": [
                "CONFIRMED_INCIDENT",
                "POTENTIAL_HAZARD",
                "NORMAL_ACTIVITY",
                "UNUSABLE_FOOTAGE",
            ],
        },
        "severity": {
            "type": "string",
            "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"],
        },
        "confidence": {"type": "number"},
        "summary": {"type": "string"},
        "observations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "timestamp": {"type": "string"},
                    "what_happens": {"type": "string"},
                    "severity": {
                        "type": "string",
                        "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
                    },
                    "entities": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["timestamp", "what_happens", "severity"],
            },
        },
        "entities_involved": {
            "type": "array",
            "items": {"type": "string"},
        },
        "visual_cues": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["assessment", "severity", "confidence", "summary"],
}


def build_prompt(location: str) -> str:
    return f"""You are a port operations CCTV video analyst for the Port of Singapore Authority (PSA).
You are inspecting camera footage for the following yard location: {location}

Your job is an INDEPENDENT visual assessment of what this footage shows. You do not know
what telemetry was recorded or what fault codes were raised — report only what is visible.

Analyze the entire clip carefully and return a JSON object matching this schema exactly:
{VIDEO_FINDING_CONTRACT}

Important:
- Set assessment to CONFIRMED_INCIDENT if you see equipment stoppage, physical collisions, unseated loads, or safety breaches.
- Set assessment to POTENTIAL_HAZARD if you see near-misses, obstacles in lane, or unusual movement without stoppage.
- Set assessment to NORMAL_ACTIVITY if yard traffic and operations proceed smoothly with no abnormalities.
- Set assessment to UNUSABLE_FOOTAGE only if the feed is black, severely corrupted, or pointing away from operations.
- Ensure confidence is a float between 0.0 and 1.0.
"""


# Gemini's Files API charges an upload per call; the same clip is reused across
# incidents that share a camera, so upload handles are cached for the process.
# Best-effort: a race between two incidents on the same clip costs one duplicate
# upload, which is cheaper than serialising every analysis behind a lock.
_upload_cache: dict[str, Any] = {}


def _resolve_to_local_path(footage: Footage) -> Optional[str]:
    """
    Returns a local file path for Gemini file upload:
      1. Local backend/video/{filename} if it exists.
      2. Downloads public_url to a tempfile if remote.
    """
    if footage.filename:
        from agent.cctv import CCTV_ROOT
        local_candidate = CCTV_ROOT / footage.filename
        if local_candidate.exists() and local_candidate.is_file():
            return str(local_candidate)

    if os.path.exists(footage.uri):
        return footage.uri

    try:
        with urlopen(footage.uri, timeout=30) as resp:
            handle = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
            handle.write(resp.read())
            handle.flush()
            return handle.name
    except Exception as exc:
        logger.warning("Could not download CCTV clip %s: %s", footage.uri, exc)
        return None


def _analyse_sync(footage: Footage, location: str) -> Optional[dict[str, Any]]:
    """Blocking Gemini call. Wrapped in a thread by analyse_footage()."""
    import json

    from google import genai
    from google.genai import types as genai_types

    client = genai.Client()

    handle = _upload_cache.get(footage.uri)
    if handle is None:
        path = _resolve_to_local_path(footage)
        if path is None:
            return None
        handle = client.files.upload(file=path)
        # Large files are processed asynchronously; polling here keeps the
        # caller's contract simple (it gets a finished result or None).
        waited = 0.0
        while getattr(handle.state, "name", "") == "PROCESSING" and waited < UPLOAD_TIMEOUT_S:
            import time

            time.sleep(2)
            waited += 2
            handle = client.files.get(name=handle.name)
        if getattr(handle.state, "name", "") != "ACTIVE":
            logger.warning("CCTV clip %s did not finish processing", footage.video_id)
            return None
        _upload_cache[footage.uri] = handle

    models_to_try = [GEMINI_MODEL, "gemini-3.6-flash", "gemini-3.7-flash"]
    last_exc = None
    for model_name in list(dict.fromkeys(models_to_try)):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[handle, build_prompt(location)],
                config=genai_types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=RESPONSE_SCHEMA,
                ),
            )
            return json.loads(response.text)
        except Exception as exc:
            last_exc = exc
            logger.warning("Gemini model %s failed: %s, trying next model", model_name, exc)
    if last_exc:
        raise last_exc
    return None


async def analyse_footage(footage: Footage, location: str) -> Optional[dict[str, Any]]:
    """
    Returns the video finding dict, or None if analysis was not possible.
    Never raises — the caller treats "no finding" and "analysis failed" alike.
    """
    if not os.getenv("GEMINI_API_KEY") and not os.getenv("GOOGLE_API_KEY"):
        logger.info("GEMINI_API_KEY not set; skipping video analysis for %s", footage.video_id)
        return None

    try:
        finding = await asyncio.to_thread(_analyse_sync, footage, location)
    except Exception:
        logger.warning("Video analysis failed for %s", footage.video_id, exc_info=True)
        return None

    if finding is None:
        return None

    finding["video_id"] = footage.video_id
    finding["uri"] = footage.uri
    finding["filename"] = footage.filename
    finding["description"] = footage.description
    finding["location"] = footage.location
    finding["model"] = GEMINI_MODEL
    logger.info(
        "Video analysis %s (%s): %s (%s, confidence %.2f)",
        footage.video_id,
        footage.filename,
        finding.get("assessment"),
        finding.get("severity"),
        float(finding.get("confidence") or 0.0),
    )
    return finding


# ---------------------------------------------------------------------------
# Graph node
# ---------------------------------------------------------------------------
MAX_CONCURRENT_VIDEO = int(os.getenv("VIDEO_MAX_CONCURRENCY", "4"))

# Analysis is deterministic in (clip, location), and one clip is shared by
# several incidents — agv_halfway_down.mp4 backs three of the seeded seven. The
# cache turns that into one Gemini call instead of three.
_analysis_cache: dict[tuple[str, str], Optional[dict[str, Any]]] = {}


async def _analyse_cached(footage: Footage, location: str) -> Optional[dict[str, Any]]:
    key = (footage.uri, location)
    if key in _analysis_cache:
        logger.debug("Reusing cached analysis for %s", footage.video_id)
        return _analysis_cache[key]
    finding = await analyse_footage(footage, location)
    _analysis_cache[key] = finding
    return finding


async def video_analysis_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    Analyses every clip attached to every incident, and returns
    {"video_findings": {incident_id: [finding, ...]}}.

    A list, not a single finding: the link is alert-level, so an incident whose
    alerts point at two cameras has two clips and both get analysed. Incidents
    with no footage are absent from the mapping entirely — downstream code
    checks for presence, so "no camera here" and "camera saw nothing" stay
    distinguishable.
    """
    from agent.cctv import load_videos, resolve_footage_for_incident

    clusters = state.get("clusters", {})
    if not clusters:
        return {"video_findings": {}}

    catalogue = load_videos()
    targets: list[tuple[str, Footage, str]] = []
    for incident_id, cluster in clusters.items():
        location = str(cluster.get("target_entity") or "the yard")
        for footage in resolve_footage_for_incident(cluster, catalogue):
            targets.append((incident_id, footage, location))

    if not targets:
        logger.info("No incidents have CCTV footage attached")
        return {"video_findings": {}}

    distinct = len({(f.uri, loc) for _, f, loc in targets})
    logger.info(
        "Analysing %d clip attachment(s) across %d incident(s) (%d distinct clips)",
        len(targets), len({t[0] for t in targets}), distinct,
    )

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_VIDEO)

    async def run(incident_id: str, footage: Footage, location: str):
        async with semaphore:
            return incident_id, footage, await _analyse_cached(footage, location)

    findings: dict[str, list[dict[str, Any]]] = {}
    for incident_id, footage, finding in await asyncio.gather(*(run(*t) for t in targets)):
        if finding is None:
            continue
        findings.setdefault(incident_id, []).append(
            {**finding, "source_alert_ids": list(footage.alert_ids)}
        )
    return {"video_findings": findings}
