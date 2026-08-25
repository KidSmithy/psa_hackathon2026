"""
Reads Stage 1's output from the real Supabase `incident_clusters` table
(see backend/database_schema.md §2.2) — not the hardcoded stub in
backend/mcp/mock_data.py, which only knows 2 clusters and uses a different
id format (`Cluster_A` vs. the real `CLUSTER-A`).

Reuses the same Supabase client the MCP servers use, so there is one
connection helper for the whole backend, not two.
"""

import json
import sys
from pathlib import Path
from typing import Any

MCP_DIR = Path(__file__).resolve().parent.parent / "mcp"
if str(MCP_DIR) not in sys.path:
    sys.path.insert(0, str(MCP_DIR))

from supabase_client import get_supabase_client  # noqa: E402


def get_incident_clusters() -> dict[str, dict[str, Any]]:
    """
    Fetches every row in incident_clusters and returns them keyed by
    cluster_id, e.g. {"CLUSTER-A": {...}, "CLUSTER-B": {...}}.

    Each entry carries `assigned_agent` straight through from the table —
    that column is the real routing decision (see coordinator.py), not
    something this project invents on top of the data.
    """
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

        clusters[row["cluster_id"]] = {
            "cluster_name": row["name"],
            "target_entity": row["primary_location"],
            "assigned_agent": row["assigned_agent"],
            "matched_alerts": raw_alert_ids,
        }
    return clusters
