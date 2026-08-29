"""
Stage 1 live pipeline — runs the real clustering algorithm over the raw alert
stream instead of reading pre-labelled clusters out of a table.

    raw_alerts (+ agv_telemetry)
        -> clustering.adapter.normalize_alert_batch   (canonical form, noise dropped)
        -> clustering.filter.run_clustering           (open, problem-type gated)
        -> incident clusters + safety escalations
        -> graph-shaped dict keyed by incidentId, ready for coordinator fan-out

The number of incidents is whatever the algorithm finds. Routing comes from
each incident's dominant problem type (see clustering/problem_types.py), so a
cluster nobody has seen before still reaches an investigator — there is no
cluster-id -> agent table to keep in sync any more.

`to_cluster_row()` converts one incident into a flat row shaped like the
frontend's IncidentClusterRow, which is also the shape written to the new
`incident_clusters_v2` table (see backend/sql/002_open_clustering.sql).
"""

from __future__ import annotations

import logging
import re
import sys
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
MCP_DIR = BACKEND_DIR / "mcp"
if str(MCP_DIR) not in sys.path:
    sys.path.insert(0, str(MCP_DIR))

from clustering import normalize_alert_batch, run_clustering  # noqa: E402
from supabase_client import get_supabase_client  # noqa: E402

logger = logging.getLogger("psa_agent.stage1")

# Table the algorithm's own output is written to. The original, hand-seeded
# `incident_clusters` table is never written to by this module — it stays as
# the known-good v1 snapshot.
CLUSTERS_TABLE = "incident_clusters_v2"
ESCALATIONS_TABLE = "safety_escalations"
RUNS_TABLE = "stage1_runs"


# ---- Ingest ------------------------------------------------------------------
def fetch_raw_inputs() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Reads the two source tables Stage 1 needs. Read-only."""
    client = get_supabase_client()
    alerts = client.table("raw_alerts").select("*").order("timestamp").execute().data or []
    telemetry = client.table("agv_telemetry").select("*").execute().data or []
    logger.info("Stage 1 ingest: %d raw alerts, %d telemetry rows", len(alerts), len(telemetry))
    return alerts, telemetry


# ---- Core --------------------------------------------------------------------
def run_stage1(
    raw_alerts: Optional[list[dict[str, Any]]] = None,
    telemetry: Optional[list[dict[str, Any]]] = None,
    config: Optional[dict[str, Any]] = None,
    filter_noise: bool = True,
) -> dict[str, Any]:
    """
    Runs the full Stage 1 chain and returns everything downstream needs:

        {
          "clusters":    [ <incident cluster dicts, ranked by priority> ],
          "escalations": [ <safety escalation dicts> ],
          "noise":       [ <raw rows dropped as noise> ],
          "stats":       { ingested, clustered, singletons, ... },
        }

    Pass raw_alerts/telemetry to run offline; omit them to read Supabase.
    """
    if raw_alerts is None:
        raw_alerts, fetched_telemetry = fetch_raw_inputs()
        telemetry = telemetry if telemetry is not None else fetched_telemetry

    normalized, noise = normalize_alert_batch(
        raw_alerts, telemetry_rows=telemetry or [], filter_noise=filter_noise
    )
    clusters, escalations = run_clustering(normalized, config=config)

    singletons = sum(1 for c in clusters if c.get("isSingleton"))
    type_mix = Counter(c.get("problemType") for c in clusters)
    stats = {
        "ingested": len(raw_alerts),
        "noiseFiltered": len(noise),
        "clustered": len(normalized),
        "incidents": len(clusters),
        "singletonIncidents": singletons,
        "safetyEscalations": len(escalations),
        "problemTypeMix": dict(sorted(type_mix.items())),
    }
    logger.info(
        "Stage 1 produced %d incidents (%d singletons) and %d safety escalations from %d alerts",
        len(clusters), singletons, len(escalations), len(raw_alerts),
    )
    return {"clusters": clusters, "escalations": escalations, "noise": noise, "stats": stats}


# ---- Shaping for the graph ---------------------------------------------------
def _member_raw_rows(cluster: dict[str, Any], raw_by_id: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    return [raw_by_id[aid] for aid in cluster["clustering"]["memberAlertIds"] if aid in raw_by_id]


def primary_location(cluster: dict[str, Any], raw_by_id: dict[str, dict[str, Any]]) -> str:
    """
    The location string an investigator's MCP tools can actually query with.

    The clustering engine works in canonical yard ids ("LANE-7", "CHARGER-B3"),
    but lane_queues/bcss_chargers/asset_relationships are keyed on the raw
    database spelling ("Lane_7", "Station_BCSS_02"). So the most common raw
    `location` among the member alerts wins, and the canonical zone is only a
    fallback for alerts that arrived without one.
    """
    locations = [str(r.get("location")) for r in _member_raw_rows(cluster, raw_by_id) if r.get("location")]
    if locations:
        return Counter(locations).most_common(1)[0][0]
    return cluster.get("location", {}).get("zoneId") or "YARD"


# Asset ids the diagnostics/telemetry tables are actually keyed on. Alert
# `source` values are a mix of real assets ("AGV-104", "BCSS-02") and reporting
# systems ("LANE_7_ENTRY_DETECTOR", "FLEET_MANAGER") — and sometimes an asset
# with a suffix ("QC-03_DISPATCH"). Only the asset part is worth handing to an
# investigator; a detector name would just produce a "not found" tool call.
# Trailing (?![0-9]) rather than \b so a suffixed source like "QC-03_DISPATCH"
# still yields "QC-03" — \b would fail there, since '_' is a word character.
ASSET_ID_PATTERN = re.compile(r"(AGV|ATT|BCSS|QC)-(\d+)(?![0-9])", re.IGNORECASE)


def target_assets(cluster: dict[str, Any], raw_by_id: dict[str, dict[str, Any]]) -> list[str]:
    """
    Concrete asset ids the investigator can pass straight to a tool, pulled
    from the member alerts' `source` fields plus the vehicles the clustering
    engine identified. Under open clustering an investigator can no longer
    assume it knows which assets an incident is about, so it gets told.

    ATT ids are rewritten back to AGV ids: the adapter renames AGV-104 to
    ATT-104 to match the Navis N4 vehicle model, but agv_telemetry and
    maintenance_records are keyed on AGV-104 (see database_schema.md 2.4/2.8),
    so handing an investigator the ATT form would guarantee a NOT_FOUND.
    """
    assets: list[str] = []
    seen: set[str] = set()

    def add(candidate: Optional[str]) -> None:
        if not candidate:
            return
        match = ASSET_ID_PATTERN.search(str(candidate))
        if not match:
            return
        prefix, number = match.group(1).upper(), match.group(2)
        if prefix == "ATT":
            prefix = "AGV"
        asset = f"{prefix}-{number}"
        if asset in seen:
            return
        seen.add(asset)
        assets.append(asset)

    for row in _member_raw_rows(cluster, raw_by_id):
        add(row.get("source"))
    for vehicle in cluster.get("participatingVehicles", []):
        vid = vehicle.get("vehicleId")
        if vid != "ATT-STATIC":
            add(vid)
    return assets


def to_graph_clusters(
    clusters: list[dict[str, Any]],
    raw_alerts: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """
    Converts Stage 1 incidents into the dict the graph's OverallState expects,
    keyed by incidentId. Same 4 keys stage1_bridge.get_incident_clusters()
    returns, plus the fields open clustering makes available.
    """
    raw_by_id = {str(r.get("id")): r for r in raw_alerts}
    out: dict[str, dict[str, Any]] = {}
    for cluster in clusters:
        incident_id = cluster["incidentId"]
        out[incident_id] = {
            "cluster_name": cluster["name"],
            "target_entity": primary_location(cluster, raw_by_id),
            "assigned_agent": cluster["assignedAgent"],
            "matched_alerts": cluster["clustering"]["memberAlertIds"],
            # --- open-clustering extras ---
            "domain": cluster["domain"],
            "problem_type": cluster["problemType"],
            "problem_type_label": cluster["problemTypeLabel"],
            "is_singleton": cluster["isSingleton"],
            "target_assets": target_assets(cluster, raw_by_id),
            "priority_score": cluster["suggestedPriority"]["score"],
            "priority_reasons": cluster["suggestedPriority"]["reasonCodes"],
            "nearest_named_feature": cluster["location"]["nearestNamedFeature"],
        }
    return out


def get_live_clusters(config: Optional[dict[str, Any]] = None) -> dict[str, dict[str, Any]]:
    """One-call convenience: Supabase -> Stage 1 -> graph-shaped clusters."""
    raw_alerts, telemetry = fetch_raw_inputs()
    result = run_stage1(raw_alerts, telemetry, config=config)
    return to_graph_clusters(result["clusters"], raw_alerts)


# ---- Shaping for persistence / the frontend ----------------------------------
def to_cluster_row(
    cluster: dict[str, Any],
    raw_by_id: dict[str, dict[str, Any]],
    run_id: str,
) -> dict[str, Any]:
    """
    Flattens one incident into an `incident_clusters_v2` row. The first five
    columns are deliberately identical to the v1 `incident_clusters` table, so
    any UI already reading v1 keeps working after only the table name changes.
    """
    return {
        "cluster_id": cluster["incidentId"],
        "name": cluster["name"],
        "primary_location": primary_location(cluster, raw_by_id),
        "assigned_agent": cluster["assignedAgent"],
        "raw_alert_ids": cluster["clustering"]["memberAlertIds"],
        # --- open-clustering columns ---
        "run_id": run_id,
        "schema_version": cluster["schemaVersion"],
        "problem_type": cluster["problemType"],
        "problem_type_label": cluster["problemTypeLabel"],
        "is_singleton": cluster["isSingleton"],
        "assigned_domain": cluster["domain"],
        "created_at": cluster["createdAt"],
        "nearest_named_feature": cluster["location"]["nearestNamedFeature"],
        "coordinates": cluster["location"]["coordinates"],
        "suggested_priority": cluster["suggestedPriority"],
        "clustering_metadata": cluster["clustering"],
        "participating_vehicles": cluster["participatingVehicles"],
        "evidence_refs": cluster["evidenceRefs"],
        "incident_metadata": cluster["metadata"],
    }


def to_escalation_row(escalation: dict[str, Any], run_id: str) -> dict[str, Any]:
    return {
        "escalation_id": escalation["escalationId"],
        "run_id": run_id,
        "schema_version": escalation["schemaVersion"],
        "route": escalation["route"],
        "escalation_tier": escalation["escalationTier"],
        "raised_at": escalation["raisedAt"],
        "source_alert_id": escalation["sourceAlertId"],
        "vehicle_id": escalation["vehicleId"],
        "error_code": escalation["errorCode"],
        "eci_event": escalation["eciEvent"],
        "location": escalation["location"],
        "last_state": escalation["lastState"],
        "evidence_refs": escalation["evidenceRefs"],
    }


def persist(
    result: dict[str, Any],
    raw_alerts: list[dict[str, Any]],
    config: Optional[dict[str, Any]] = None,
    replace: bool = True,
) -> dict[str, Any]:
    """
    Writes a Stage 1 run to the v2 tables. `incident_clusters` (v1) is never
    touched.

    replace=True clears the v2 tables first, so the UI shows one coherent
    picture of the latest run. replace=False appends, keeping every run
    side-by-side — each row carries the `run_id` that produced it, so history
    stays queryable either way.
    """
    client = get_supabase_client()
    run_id = f"RUN-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:6]}"
    raw_by_id = {str(r.get("id")): r for r in raw_alerts}

    cluster_rows = [to_cluster_row(c, raw_by_id, run_id) for c in result["clusters"]]
    escalation_rows = [to_escalation_row(e, run_id) for e in result["escalations"]]

    run_row = {
        "run_id": run_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "config": dict(config or {}),
        "stats": result["stats"],
        "noise_alert_ids": [str(n.get("id")) for n in result["noise"]],
    }

    if replace:
        # PostgREST requires a filter on delete; neq on a value no id can hold
        # is the standard "delete everything" idiom.
        client.table(CLUSTERS_TABLE).delete().neq("cluster_id", "__none__").execute()
        client.table(ESCALATIONS_TABLE).delete().neq("escalation_id", "__none__").execute()
        logger.info("Cleared %s and %s before writing run %s", CLUSTERS_TABLE, ESCALATIONS_TABLE, run_id)

    client.table(RUNS_TABLE).insert(run_row).execute()
    if cluster_rows:
        client.table(CLUSTERS_TABLE).upsert(cluster_rows, on_conflict="cluster_id").execute()
    if escalation_rows:
        client.table(ESCALATIONS_TABLE).upsert(escalation_rows, on_conflict="escalation_id").execute()

    logger.info(
        "Persisted run %s: %d clusters, %d escalations", run_id, len(cluster_rows), len(escalation_rows)
    )
    return {"run_id": run_id, "clusters": len(cluster_rows), "escalations": len(escalation_rows), "stats": result["stats"]}
