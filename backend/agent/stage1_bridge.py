"""
Supplies the graph with its Stage 1 clusters, from one of two sources:

  live  (default) — runs the real clustering algorithm over `raw_alerts` via
                    agent/stage1_pipeline.py. Open clustering: however many
                    incidents the alert stream actually contains, grouped by
                    problem type, singletons included.
  table           — reads the pre-labelled `incident_clusters` table (the
                    original hand-seeded CLUSTER-A..D snapshot). Kept so the
                    previous working demo can still be run unchanged.

Pick with STAGE1_SOURCE=live|table in backend/.env. Both return the same
shape, so nothing downstream needs to know which one ran.
"""

import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Optional

MCP_DIR = Path(__file__).resolve().parent.parent / "mcp"
if str(MCP_DIR) not in sys.path:
    sys.path.insert(0, str(MCP_DIR))

from agent.stage1_pipeline import get_live_clusters  # noqa: E402
from supabase_client import get_supabase_client  # noqa: E402

logger = logging.getLogger("psa_agent.stage1_bridge")

STAGE1_SOURCE = os.getenv("STAGE1_SOURCE", "live").strip().lower()


def get_incident_clusters() -> dict[str, dict[str, Any]]:
    """
    Legacy path: every row in the hand-seeded `incident_clusters` table, keyed
    by cluster_id, e.g. {"CLUSTER-A": {...}, "CLUSTER-B": {...}}.

    `assigned_agent` comes straight through from the table, and `domain` is
    derived from it so the coordinator can route these rows the same way it
    routes freshly clustered ones.
    """
    from agent.coordinator import AGENT_TO_INVESTIGATOR_NODE, DEFAULT_INVESTIGATOR_NODE

    client = get_supabase_client()
    response = client.table("incident_clusters").select("*").execute()

    clusters: dict[str, dict[str, Any]] = {}
    for row in response.data:
        raw_alert_ids = row.get("raw_alert_ids", [])
        # JSONB columns usually come back as a Python list already, but the
        # column has been seen returned as a JSON-encoded string too —
        # handle both rather than assume one.
        if isinstance(raw_alert_ids, str):
            raw_alert_ids = json.loads(raw_alert_ids)

        assigned_agent = row["assigned_agent"]
        clusters[row["cluster_id"]] = {
            "cluster_name": row["name"],
            "target_entity": row["primary_location"],
            "assigned_agent": assigned_agent,
            "matched_alerts": raw_alert_ids,
            "domain": AGENT_TO_INVESTIGATOR_NODE.get(assigned_agent, DEFAULT_INVESTIGATOR_NODE),
        }
    return clusters


def get_clusters(
    source: Optional[str] = None,
    config: Optional[dict[str, Any]] = None,
) -> dict[str, dict[str, Any]]:
    """
    The single entry point the graph and the HTTP API use. `source` overrides
    STAGE1_SOURCE for one call (handy for a demo toggle in the UI later).
    """
    chosen = (source or STAGE1_SOURCE).strip().lower()
    if chosen == "table":
        logger.info("Stage 1 source: pre-labelled incident_clusters table (v1 snapshot)")
        return get_incident_clusters()
    if chosen != "live":
        raise ValueError(f"Unknown STAGE1_SOURCE '{chosen}' — expected 'live' or 'table'")
    logger.info("Stage 1 source: live open clustering over raw_alerts")
    return get_live_clusters(config=config)
