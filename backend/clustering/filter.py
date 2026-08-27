"""
Stage 1: Deterministic ST-DBSCAN + Topology Filter & Priority Scorer.

Takes raw alert streams and collapses them into correlated Incident Clusters conforming
to AGV Exception Handling POC Data Contract (schemaVersion 1.1.0).
Safety-channel alerts are routed directly into unscored Safety Escalation records.
"""

import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from . import yard

SCHEMA_VERSION = "1.1.0"

# ---- Clustering Configuration -----------------------------------------------
DEFAULT_SPATIAL_WINDOW_M = 40.0
DEFAULT_TEMPORAL_WINDOW_S = 20.0
DEFAULT_TOPOLOGY_MAX_HOPS = 1
DEFAULT_MIN_PTS = 1
CLUSTERING_METHOD = "st-dbscan+topology"

# Chain guard limits: cuts run-away agglomerations at widest temporal gap
DEFAULT_MAX_CLUSTER_ALERTS = 12
DEFAULT_MAX_CLUSTER_DWELL_S = 300.0

# ---- Priority & Urgency Scoring Configuration --------------------------------
FAULT_SEVERITY: Dict[str, float] = {
    "JUNCTION_CONTENTION": 0.35,
    "SPREADER_LOCK_FAULT": 0.30,
    "TWISTLOCK_TIMEOUT": 0.30,
    "CRANE_HANDOFF_MISMATCH": 0.30,
    "FEEDER_STARVATION": 0.30,
    "OBSTRUCTION_DETECTED": 0.28,
    "COMMS_TIMEOUT": 0.25,
    "BCSS_CHARGER_TRIP": 0.20,
    "BREAKER_TRIPPED": 0.20,
    "OVERTEMP_WARNING": 0.20,
    "BATTERY_LOW_CRITICAL": 0.20,
    "LIDAR_SAFETY_TRIP": 0.22,
    "LOCALIZATION_LOST": 0.18,
}
FAULT_SEVERITY_DEFAULT = 0.15

PRIORITY_WEIGHTS: Dict[str, float] = {
    "blocks_junction": 0.20,          # Sits on a junction -> knock-on traffic
    "blocks_crane_handoff": 0.18,     # Quay-side -> stalls a crane cycle
    "multi_vehicle": 0.10,            # Per extra vehicle, capped at MULTI_VEHICLE_CAP
    "laden_cargo": 0.08,              # Loaded container at stake
    "protective_field_active": 0.15,  # Onboard safety scanner sees intrusion
    "wi_status_conflict": 0.12,       # STOPPED while WI is IN_PROGRESS
    "comms_ambiguous": 0.06,          # Offline connection or comms timeout
    "low_battery_risk": 0.07,         # < 20% SoC and stalled
    "sla_breach_risk": 0.10,          # Dwelling past dwell threshold
    "charger_capacity_risk": 0.05,    # Charging bay taken out of service
}

MULTI_VEHICLE_CAP = 0.20
SLA_DWELL_SECONDS = 120.0
LOW_BATTERY_PCT = 20.0
SCORE_FLOOR, SCORE_CEILING = 0.05, 0.99
COMBINE_METHOD = "noisy_or"

SAFETY_ERROR_CODES: Set[str] = {
    "SAFETY_FIELD_VIOLATION",
    "ECI_SAFETY_FIELD_TRIPPED",
    "EMERGENCY_STOP_TRIP",
}


# ---- Timestamp & Distance Helpers --------------------------------------------
def parse_ts(ts_val: Any) -> datetime:
    """Parses various timestamp representations into UTC datetime."""
    if isinstance(ts_val, datetime):
        return ts_val if ts_val.tzinfo else ts_val.replace(tzinfo=timezone.utc)
    s = str(ts_val).strip()
    # Handle ISO 8601 variations
    for fmt in (
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S.%fZ",
    ):
        try:
            dt = datetime.strptime(s, fmt)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    # Fallback to dateutil if needed
    try:
        from datetime import datetime as dt_cls
        return dt_cls.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


def fmt_ts(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def dist(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    pos_a = a.get("position") or {"x": 0.0, "y": 0.0}
    pos_b = b.get("position") or {"x": 0.0, "y": 0.0}
    return math.hypot(pos_a["x"] - pos_b["x"], pos_a["y"] - pos_b["y"])


def get_resource_id(alert: Dict[str, Any]) -> Optional[str]:
    res = alert.get("sharedResource")
    if isinstance(res, dict):
        return res.get("id")
    if isinstance(res, str):
        return res
    # Fallback to zoneId or location if direct resource match
    loc = alert.get("location") or alert.get("zoneId")
    return yard.canonical_resource_id(loc)


def is_safety_alert(alert: Dict[str, Any]) -> bool:
    channel = alert.get("channel", "telemetry")
    if channel == "safety":
        return True
    error_code = alert.get("errorCode") or alert.get("type")
    if error_code in SAFETY_ERROR_CODES:
        return True
    return False


# ---- Step 2: Clustering Logic ------------------------------------------------
def linked(
    a: Dict[str, Any],
    b: Dict[str, Any],
    spatial_window_m: float = DEFAULT_SPATIAL_WINDOW_M,
    temporal_window_s: float = DEFAULT_TEMPORAL_WINDOW_S,
    topology_max_hops: int = DEFAULT_TOPOLOGY_MAX_HOPS,
) -> Tuple[bool, Optional[str]]:
    """The ST-DBSCAN + topology neighbourhood predicate."""
    dt = abs((parse_ts(a["raisedAt"]) - parse_ts(b["raisedAt"])).total_seconds())
    if dt > temporal_window_s:
        return False, None
    if dist(a, b) <= spatial_window_m:
        return True, "spatial"
    res_a = get_resource_id(a)
    res_b = get_resource_id(b)
    if res_a and res_b and yard.topology_linked(res_a, res_b, topology_max_hops):
        return True, "topology"
    return False, None


def cluster_alerts(
    alerts: List[Dict[str, Any]],
    spatial_window_m: float = DEFAULT_SPATIAL_WINDOW_M,
    temporal_window_s: float = DEFAULT_TEMPORAL_WINDOW_S,
    topology_max_hops: int = DEFAULT_TOPOLOGY_MAX_HOPS,
    min_pts: int = DEFAULT_MIN_PTS,
    max_cluster_alerts: int = DEFAULT_MAX_CLUSTER_ALERTS,
    max_cluster_dwell_s: float = DEFAULT_MAX_CLUSTER_DWELL_S,
) -> List[List[Dict[str, Any]]]:
    """Union-find single-link agglomeration over neighbourhood predicate with chain-guard."""
    n = len(alerts)
    if n == 0:
        return []

    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[max(ri, rj)] = min(ri, rj)

    degree = [0] * n
    for i in range(n):
        for j in range(i + 1, n):
            ok, _ = linked(alerts[i], alerts[j], spatial_window_m, temporal_window_s, topology_max_hops)
            if ok:
                degree[i] += 1
                degree[j] += 1
                union(i, j)

    if min_pts > 1:
        parent = list(range(n))
        for i in range(n):
            if degree[i] + 1 < min_pts:
                continue
            for j in range(n):
                if i != j and linked(alerts[i], alerts[j], spatial_window_m, temporal_window_s, topology_max_hops)[0]:
                    union(i, j)

    groups = defaultdict(list)
    for idx, a in enumerate(alerts):
        groups[find(idx)].append(a)

    out = []
    for g in groups.values():
        sorted_g = sorted(g, key=lambda a: parse_ts(a["raisedAt"]))
        out.extend(chain_guard(sorted_g, max_cluster_alerts, max_cluster_dwell_s))
    out.sort(key=lambda g: parse_ts(g[0]["raisedAt"]))
    return out


def is_oversized(group: List[Dict[str, Any]], max_alerts: int, max_dwell_s: float) -> bool:
    if len(group) <= 1:
        return False
    dwell = (parse_ts(group[-1]["raisedAt"]) - parse_ts(group[0]["raisedAt"])).total_seconds()
    return len(group) > max_alerts or dwell > max_dwell_s


def chain_guard(
    group: List[Dict[str, Any]],
    max_alerts: int = DEFAULT_MAX_CLUSTER_ALERTS,
    max_dwell_s: float = DEFAULT_MAX_CLUSTER_DWELL_S,
) -> List[List[Dict[str, Any]]]:
    """Splits an oversized chain at its widest temporal gap recursively."""
    if len(group) < 2 or not is_oversized(group, max_alerts, max_dwell_s):
        return [group]
    times = [parse_ts(a["raisedAt"]) for a in group]
    gaps = [(times[i + 1] - times[i]).total_seconds() for i in range(len(times) - 1)]
    cut = max(range(len(gaps)), key=lambda i: (gaps[i], -abs(i - len(gaps) // 2)))
    left, right = group[: cut + 1], group[cut + 1 :]
    if not left or not right:
        mid = len(group) // 2
        left, right = group[:mid], group[mid:]
    return chain_guard(left, max_alerts, max_dwell_s) + chain_guard(right, max_alerts, max_dwell_s)


def topology_match(group: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Identifies the dominant shared resource for the incident cluster."""
    ids = {get_resource_id(a) for a in group}
    ids.discard(None)
    if len(ids) == 1:
        rid = ids.pop()
        return {
            "matched": True,
            "sharedResourceId": rid,
            "sharedResourceType": yard.resource_type(rid),
        }
    if len(ids) > 1:
        counts = defaultdict(int)
        for a in group:
            rid = get_resource_id(a)
            if rid:
                counts[rid] += 1
        rid = max(sorted(counts), key=lambda r: counts[r])
        return {
            "matched": True,
            "sharedResourceId": rid,
            "sharedResourceType": yard.resource_type(rid),
        }
    return {"matched": False, "sharedResourceId": None, "sharedResourceType": None}


# ---- Step 3: Priority Scoring (Noisy-OR) ------------------------------------
def score_cluster(group: List[Dict[str, Any]], topo: Dict[str, Any]) -> Tuple[float, List[str], List[Dict[str, Any]]]:
    """
    Deterministic priority score calculation.
    Combines factors monotonically via noisy-OR: 1 - prod(1 - w).
    """
    vehicles = {a.get("vehicleId") for a in group if a.get("vehicleId")}
    faults = [a.get("errorCode") for a in group if a.get("errorCode")]
    states = [a.get("state", {}) for a in group]

    base_fault = max(
        faults,
        key=lambda f: FAULT_SEVERITY.get(f, FAULT_SEVERITY_DEFAULT),
        default=None,
    )
    base_weight = FAULT_SEVERITY.get(base_fault, FAULT_SEVERITY_DEFAULT) if base_fault else 0.10

    contributions: List[Tuple[str, float]] = []
    if base_fault:
        contributions.append((f"fault:{base_fault.lower()}", base_weight))
    else:
        contributions.append(("state_only_anomaly", base_weight))

    w = PRIORITY_WEIGHTS
    rtype = topo.get("sharedResourceType")
    if rtype == "junction":
        contributions.append(("blocks_junction", w["blocks_junction"]))
    elif rtype == "crane_handoff":
        contributions.append(("blocks_crane_handoff", w["blocks_crane_handoff"]))
    elif rtype == "charger":
        contributions.append(("charger_capacity_risk", w["charger_capacity_risk"]))

    if len(vehicles) > 1:
        contributions.append(
            ("multi_vehicle", min((len(vehicles) - 1) * w["multi_vehicle"], MULTI_VEHICLE_CAP))
        )

    if any(s.get("loadState") == "LOADED" for s in states):
        contributions.append(("laden_cargo", w["laden_cargo"]))

    if any(s.get("protectiveFieldViolation") for s in states):
        contributions.append(("protective_field_active", w["protective_field_active"]))

    if any(
        a.get("state", {}).get("drivingState") == "STOPPED"
        and a.get("workAssignment", {}).get("wiStatus") == "IN_PROGRESS"
        for a in group
    ):
        contributions.append(("wi_status_conflict", w["wi_status_conflict"]))

    if any(s.get("connectionState") == "OFFLINE" for s in states) or "COMMS_TIMEOUT" in faults:
        contributions.append(("comms_ambiguous", w["comms_ambiguous"]))

    if any(s.get("batteryPct", 100) < LOW_BATTERY_PCT for s in states):
        contributions.append(("low_battery_risk", w["low_battery_risk"]))

    dwell = (parse_ts(group[-1]["raisedAt"]) - parse_ts(group[0]["raisedAt"])).total_seconds()
    if dwell > SLA_DWELL_SECONDS:
        contributions.append(("sla_breach_risk", w["sla_breach_risk"]))
    else:
        contributions.append(("no_sla_breach_yet", 0.0))

    # Noisy-OR combination: 1 - prod(1 - v)
    residual = 1.0
    for _, v in contributions:
        residual *= (1.0 - min(max(v, 0.0), 0.95))
    raw = 1.0 - residual
    score = round(min(max(raw, SCORE_FLOOR), SCORE_CEILING), 2)
    reason_codes = [c for c, _ in sorted(contributions, key=lambda kv: -kv[1])]
    breakdown = [{"code": c, "weight": round(v, 3)} for c, v in contributions]
    return score, reason_codes, breakdown


# ---- Step 4: Emit Cluster & Vehicles -----------------------------------------
def build_vehicles(group: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_vehicle = defaultdict(list)
    for a in group:
        vid = a.get("vehicleId") or "UNKNOWN_VEHICLE"
        by_vehicle[vid].append(a)

    def vehicle_severity(v_alerts: List[Dict[str, Any]]) -> float:
        return max(
            (FAULT_SEVERITY.get(a.get("errorCode"), FAULT_SEVERITY_DEFAULT)
             for a in v_alerts if a.get("errorCode")),
            default=-1.0,
        )

    order = sorted(by_vehicle.items(), key=lambda kv: (-vehicle_severity(kv[1]), parse_ts(kv[1][0]["raisedAt"])))
    vehicles = []
    for idx, (vid, v_alerts) in enumerate(order):
        latest = max(v_alerts, key=lambda a: parse_ts(a["raisedAt"]))
        has_fault = any(a.get("errorCode") for a in v_alerts)
        role = "lead" if (idx == 0 and has_fault) else ("trailing" if has_fault else "bystander")
        errors = [
            {
                "eciEvent": a.get("eciEvent", "ECI_AGV_STATUS_UPDATED"),
                "errorCode": a.get("errorCode"),
                "raisedAt": a.get("raisedAt"),
            }
            for a in v_alerts
            if a.get("errorCode")
        ]
        wa = latest.get("workAssignment", {})
        st = latest.get("state", {})
        vehicles.append(
            {
                "vehicleId": vid,
                "role": role,
                "workAssignment": {
                    "waId": wa.get("waId", "WA-NONE"),
                    "wiStatus": wa.get("wiStatus", "IN_PROGRESS"),
                },
                "lastState": {
                    "timestamp": latest.get("raisedAt"),
                    "position": latest.get("position", {"x": 0.0, "y": 0.0}),
                    "batteryPct": st.get("batteryPct", 100),
                    "loadState": st.get("loadState", "EMPTY"),
                    "drivingState": st.get("drivingState", "STOPPED"),
                    "connectionState": st.get("connectionState", "ONLINE"),
                    "protectiveFieldViolation": st.get("protectiveFieldViolation", False),
                    "errors": errors,
                },
            }
        )
    return vehicles


def build_evidence_refs(
    group: List[Dict[str, Any]],
    vehicles: List[Dict[str, Any]],
    topo: Dict[str, Any],
) -> List[Dict[str, Any]]:
    refs = []
    faults = {a.get("errorCode") for a in group if a.get("errorCode")}
    lead = vehicles[0]["vehicleId"] if vehicles else "ATT-UNKNOWN"
    zone = group[0].get("zoneId") or "YARD"

    for v in vehicles:
        vid = v["vehicleId"]
        refs.append({"type": "telemetry_stream", "vehicleId": vid, "uri": f"sim://telemetry/{vid}?window=60s"})
        refs.append({"type": "task_context", "vehicleId": vid, "uri": f"sim://tasks/{vid}/current"})

    latest = max(group, key=lambda a: parse_ts(a["raisedAt"]))
    refs.append({
        "type": "camera_snapshot",
        "vehicleId": lead,
        "uri": f"sim://camera/{zone}/latest.jpg",
        "capturedAt": latest.get("raisedAt"),
    })

    cranes = {a.get("resourceRefs", {}).get("craneId") for a in group if a.get("resourceRefs")}
    cranes.discard(None)
    for crane in sorted(cranes):
        refs.append({"type": "crane_status", "resourceId": crane, "uri": f"sim://cranes/{crane}/status"})

    spatial_question = bool(
        faults & {"OBSTRUCTION_DETECTED", "LOCALIZATION_LOST", "JUNCTION_CONTENTION", "LIDAR_SAFETY_TRIP"}
    ) or any(v["lastState"]["protectiveFieldViolation"] for v in vehicles)

    if spatial_question:
        refs.append({
            "type": "lidar_scan",
            "vehicleId": lead,
            "uri": f"sim://lidar/{lead}/latest",
            "format": "point_cloud_summary",
        })
        refs.append({
            "type": "cv_detection",
            "vehicleId": lead,
            "uri": f"sim://cv/{lead}/latest",
            "format": "structured_json",
        })

    if topo.get("sharedResourceId"):
        rid = topo["sharedResourceId"]
        refs.append({"type": "resource_status", "resourceId": rid, "uri": f"sim://resources/{rid}/status"})

    return refs


def generate_incident_id(group: List[Dict[str, Any]], seq: int) -> str:
    created = parse_ts(group[-1]["raisedAt"])
    return f"INC-{created.year}-{created.strftime('%m%d')}-{seq:04d}"


def build_cluster(
    group: List[Dict[str, Any]],
    seq: int,
    safety_escalations: List[Dict[str, Any]],
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    topo = topology_match(group)
    vehicles = build_vehicles(group)
    score, reason_codes, breakdown = score_cluster(group, topo)
    created = parse_ts(group[-1]["raisedAt"])

    rid = topo.get("sharedResourceId")
    if rid:
        cx, cy = yard.resource_point(rid) or (400.0, 200.0)
        feature = yard.NAMED_FEATURE.get(rid, rid)
    else:
        cx = sum(a.get("position", {}).get("x", 0.0) for a in group) / len(group)
        cy = sum(a.get("position", {}).get("y", 0.0) for a in group) / len(group)
        zone_label = group[0].get("zoneId") or "YARD"
        feature = f"{zone_label} (no shared resource)"

    inc_id = generate_incident_id(group, seq)

    temporal_window_s = (config or {}).get("temporal_window_s", DEFAULT_TEMPORAL_WINDOW_S)
    spatial_window_m = (config or {}).get("spatial_window_m", DEFAULT_SPATIAL_WINDOW_M)

    # Cross-reference overlapping safety escalations
    coincident = [
        e["escalationId"]
        for e in safety_escalations
        if abs((parse_ts(e["raisedAt"]) - created).total_seconds()) <= temporal_window_s
        and math.hypot(
            e["location"]["coordinates"]["x"] - cx,
            e["location"]["coordinates"]["y"] - cy,
        ) <= spatial_window_m
    ]

    return {
        "schemaVersion": SCHEMA_VERSION,
        "incidentId": inc_id,
        "createdAt": fmt_ts(created),
        "clustering": {
            "method": CLUSTERING_METHOD,
            "spatialWindowMeters": spatial_window_m,
            "temporalWindowSeconds": temporal_window_s,
            "topologyMatch": topo,
            "memberAlertIds": [a["alertId"] for a in group],
            "rawAlertCount": len(group),
        },
        "suggestedPriority": {"score": score, "reasonCodes": reason_codes},
        "location": {
            "zoneId": group[0].get("zoneId", "YARD"),
            "coordinates": {"x": round(cx, 1), "y": round(cy, 1)},
            "nearestNamedFeature": feature,
        },
        "participatingVehicles": vehicles,
        "evidenceRefs": build_evidence_refs(group, vehicles, topo),
        "metadata": {
            "priorityCombination": COMBINE_METHOD,
            "priorityBreakdown": breakdown,
            "chainGuardLimits": {
                "maxAlerts": (config or {}).get("max_cluster_alerts", DEFAULT_MAX_CLUSTER_ALERTS),
                "maxDwellSeconds": (config or {}).get("max_cluster_dwell_s", DEFAULT_MAX_CLUSTER_DWELL_S),
            },
            "coincidentSafetyEscalationIds": coincident,
            "memberAlertTimes": [a["raisedAt"] for a in group],
            "memberAlertPositions": [a.get("position", {"x": 0.0, "y": 0.0}) for a in group],
        },
    }


def build_escalation(alert: Dict[str, Any], seq: int) -> Dict[str, Any]:
    """Safety alerts skip scoring and form direct immediate escalations."""
    rid = get_resource_id(alert)
    created = parse_ts(alert["raisedAt"])
    return {
        "schemaVersion": SCHEMA_VERSION,
        "escalationId": f"ESC-{created.strftime('%Y-%m%d')}-{seq:04d}",
        "route": "safety_stream_direct",
        "escalationTier": "SAFETY_IMMEDIATE",
        "scored": False,
        "raisedAt": alert["raisedAt"],
        "sourceAlertId": alert["alertId"],
        "eciEvent": alert.get("eciEvent", "ECI_SAFETY_FIELD_TRIPPED"),
        "errorCode": alert.get("errorCode", "SAFETY_FIELD_VIOLATION"),
        "vehicleId": alert.get("vehicleId", "ATT-UNKNOWN"),
        "location": {
            "zoneId": alert.get("zoneId", "YARD"),
            "coordinates": alert.get("position", {"x": 0.0, "y": 0.0}),
            "nearestNamedFeature": yard.NAMED_FEATURE.get(rid, alert.get("zoneId", "YARD")),
        },
        "lastState": alert.get("state", {}),
        "evidenceRefs": [
            {
                "type": "camera_snapshot",
                "vehicleId": alert.get("vehicleId", "ATT-UNKNOWN"),
                "uri": f"sim://camera/{alert.get('zoneId', 'YARD')}/latest.jpg",
                "capturedAt": alert["raisedAt"],
            },
            {
                "type": "lidar_scan",
                "vehicleId": alert.get("vehicleId", "ATT-UNKNOWN"),
                "uri": f"sim://lidar/{alert.get('vehicleId', 'ATT-UNKNOWN')}/latest",
                "format": "point_cloud_summary",
            },
        ],
    }


def run_clustering(
    alerts: List[Dict[str, Any]],
    config: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Main Stage 1 entry point:
    Splits safety stream, clusters telemetry stream via ST-DBSCAN+topology,
    computes priority scores, and returns (incident_clusters, safety_escalations).
    """
    cfg = config or {}
    spatial_window_m = cfg.get("spatial_window_m", DEFAULT_SPATIAL_WINDOW_M)
    temporal_window_s = cfg.get("temporal_window_s", DEFAULT_TEMPORAL_WINDOW_S)
    topology_max_hops = cfg.get("topology_max_hops", DEFAULT_TOPOLOGY_MAX_HOPS)
    min_pts = cfg.get("min_pts", DEFAULT_MIN_PTS)
    max_cluster_alerts = cfg.get("max_cluster_alerts", DEFAULT_MAX_CLUSTER_ALERTS)
    max_cluster_dwell_s = cfg.get("max_cluster_dwell_s", DEFAULT_MAX_CLUSTER_DWELL_S)

    safety_alerts = [a for a in alerts if is_safety_alert(a)]
    telemetry = [a for a in alerts if not is_safety_alert(a)]
    telemetry.sort(key=lambda a: parse_ts(a["raisedAt"]))

    escalations = [
        build_escalation(a, i + 1)
        for i, a in enumerate(sorted(safety_alerts, key=lambda a: parse_ts(a["raisedAt"])))
    ]

    groups = cluster_alerts(
        telemetry,
        spatial_window_m=spatial_window_m,
        temporal_window_s=temporal_window_s,
        topology_max_hops=topology_max_hops,
        min_pts=min_pts,
        max_cluster_alerts=max_cluster_alerts,
        max_cluster_dwell_s=max_cluster_dwell_s,
    )

    clusters = [build_cluster(g, i + 1, escalations, cfg) for i, g in enumerate(groups)]
    clusters.sort(key=lambda c: -c["suggestedPriority"]["score"])
    return clusters, escalations
