"""
Problem-type taxonomy for open clustering.

Stage 1 used to be purely spatio-temporal: anything close enough in space and
time got glued into one incident, which is how a lane jam, an actuator fault
and a starved crane all ended up inside a single hand-labelled "CLUSTER-A".

Open clustering replaces that with a type gate: two alerts only join the same
incident if they describe the *same kind of problem* as well as being close in
space and time. Anything whose problem type can't be established (or whose
family is listed in SINGLETON_FAMILIES) never agglomerates — it stays its own
single-alert incident rather than being absorbed by a neighbour.

Nothing here is scenario-specific: the taxonomy is keyed on fault codes and
alert types, so a stream containing faults this file has never seen still
classifies (as UNCLASSIFIED) and still produces a valid incident.
"""

from typing import Any, Dict, List, Optional, Set

# ---- Families ----------------------------------------------------------------
TRAFFIC_FLOW = "TRAFFIC_FLOW"
MECHANICAL_ACTUATOR = "MECHANICAL_ACTUATOR"
POWER_CHARGING = "POWER_CHARGING"
FLEET_BATTERY = "FLEET_BATTERY"
PERCEPTION_SAFETY = "PERCEPTION_SAFETY"
CRANE_HANDOFF = "CRANE_HANDOFF"
COMMS_NAVIGATION = "COMMS_NAVIGATION"
ENVIRONMENT = "ENVIRONMENT"
UNCLASSIFIED = "UNCLASSIFIED"

PROBLEM_TYPES: List[str] = [
    TRAFFIC_FLOW,
    MECHANICAL_ACTUATOR,
    POWER_CHARGING,
    FLEET_BATTERY,
    PERCEPTION_SAFETY,
    CRANE_HANDOFF,
    COMMS_NAVIGATION,
    ENVIRONMENT,
    UNCLASSIFIED,
]

# Families whose alerts are never merged with anything, even a same-family
# neighbour. An alert we could not type is not evidence that it belongs with
# whatever happened to be nearby — it becomes a singleton incident.
SINGLETON_FAMILIES: Set[str] = {UNCLASSIFIED}

# Human-readable label used when naming an incident.
PROBLEM_TYPE_LABEL: Dict[str, str] = {
    TRAFFIC_FLOW: "Traffic Flow Blockage",
    MECHANICAL_ACTUATOR: "Mechanical / Actuator Fault",
    POWER_CHARGING: "Charging Station Power Fault",
    FLEET_BATTERY: "Fleet Battery Starvation",
    PERCEPTION_SAFETY: "Perception / Safety Stop",
    CRANE_HANDOFF: "Crane Handoff Disruption",
    COMMS_NAVIGATION: "Comms / Localization Loss",
    ENVIRONMENT: "Environmental Advisory",
    UNCLASSIFIED: "Unclassified Anomaly",
}

# ---- Exact fault-code / alert-type mapping -----------------------------------
# Keys are matched case-insensitively against the candidate codes on the alert,
# in the order _candidate_codes returns them.
TYPE_TO_FAMILY: Dict[str, str] = {
    # Traffic and lane flow
    "TRAFFIC_CONGESTION": TRAFFIC_FLOW,
    "HEADWAY_VIOLATION": TRAFFIC_FLOW,
    "JUNCTION_CONTENTION": TRAFFIC_FLOW,
    "THROUGHPUT_DROP": TRAFFIC_FLOW,
    "OBSTACLE_PROXIMITY": TRAFFIC_FLOW,
    "OBSTRUCTION_DETECTED": TRAFFIC_FLOW,
    "UNEXPECTED_STOP": TRAFFIC_FLOW,
    "LANE_BLOCKED": TRAFFIC_FLOW,
    "QUEUE_STALLED": TRAFFIC_FLOW,
    # Mechanical / actuator
    "TWISTLOCK_TIMEOUT": MECHANICAL_ACTUATOR,
    "SPREADER_LOCK_FAULT": MECHANICAL_ACTUATOR,
    "ERR_TWISTLOCK_TIMEOUT": MECHANICAL_ACTUATOR,
    "ACTUATOR_ERR": MECHANICAL_ACTUATOR,
    "HYDRAULIC_HIGH_PRESSURE": MECHANICAL_ACTUATOR,
    "HYDRAULIC_LOW_PRESSURE": MECHANICAL_ACTUATOR,
    "DRIVE_MOTOR_OVERTEMP": MECHANICAL_ACTUATOR,
    "BRAKE_FAULT": MECHANICAL_ACTUATOR,
    # Charging station power / thermal
    "BREAKER_TRIPPED": POWER_CHARGING,
    "BCSS_CHARGER_TRIP": POWER_CHARGING,
    "OVERTEMP_WARNING": POWER_CHARGING,
    "OVERTEMP_THERMAL_CUTOFF": POWER_CHARGING,
    "VOLTAGE_DROP": POWER_CHARGING,
    "BUS_FAULT": POWER_CHARGING,
    "COOLING_LOOP_FAIL": POWER_CHARGING,
    "CHARGING_SESSION_ABORTED": POWER_CHARGING,
    "CHARGER_UNAVAILABLE": POWER_CHARGING,
    "ERR_INSULATION_LEAKAGE": POWER_CHARGING,
    # Fleet-level battery / dispatch starvation
    "BATTERY_LOW_CRITICAL": FLEET_BATTERY,
    "BATTERY_WARNING": FLEET_BATTERY,
    "ERR_BMS_CRITICAL_SOC": FLEET_BATTERY,
    "REROUTE_FAIL": FLEET_BATTERY,
    "DEADLOCK_RISK": FLEET_BATTERY,
    "SOC_STARVATION": FLEET_BATTERY,
    # Perception / onboard safety
    "LIDAR_SAFETY_TRIP": PERCEPTION_SAFETY,
    "OPTICAL_OCCLUSION": PERCEPTION_SAFETY,
    "SAFETY_FIELD_VIOLATION": PERCEPTION_SAFETY,
    "ECI_SAFETY_FIELD_TRIPPED": PERCEPTION_SAFETY,
    "EMERGENCY_STOP_TRIP": PERCEPTION_SAFETY,
    "PROTECTIVE_FIELD_VIOLATION": PERCEPTION_SAFETY,
    # Quay crane handoff
    "FEEDER_STARVATION": CRANE_HANDOFF,
    "CRANE_HANDOFF_MISMATCH": CRANE_HANDOFF,
    "QC_CYCLE_STALLED": CRANE_HANDOFF,
    # Comms / navigation
    "COMMS_TIMEOUT": COMMS_NAVIGATION,
    "CONNECTION_LOST": COMMS_NAVIGATION,
    "HEARTBEAT_MISSED": COMMS_NAVIGATION,
    "LOCALIZATION_LOST": COMMS_NAVIGATION,
    # Environmental / advisory
    "WIND_GUST_ADVISORY": ENVIRONMENT,
    "REEFER_TEMP_NORMAL": ENVIRONMENT,
    "SESSION_COMPLETED": ENVIRONMENT,
    "CYCLE_COMPLETE": ENVIRONMENT,
}

# Fallback keyword rules, applied to the alert type and message only when no
# exact code matched. Ordered — first hit wins.
KEYWORD_RULES: List[tuple] = [
    (("twistlock", "spreader", "hydraulic", "actuator"), MECHANICAL_ACTUATOR),
    (("lidar", "optical", "safety field", "protective field", "e-stop"), PERCEPTION_SAFETY),
    (("breaker", "busbar", "voltage", "charger", "charging", "coolant", "insulation"), POWER_CHARGING),
    (("battery", "soc", "state of charge", "reroute"), FLEET_BATTERY),
    (("crane", "quay", "feeder", "handoff"), CRANE_HANDOFF),
    (("congestion", "headway", "queue", "obstacle", "blocked", "throughput"), TRAFFIC_FLOW),
    (("comms", "offline", "heartbeat", "localization", "localisation"), COMMS_NAVIGATION),
    (("wind", "weather", "reefer"), ENVIRONMENT),
]


def _candidate_codes(alert: Dict[str, Any]) -> List[str]:
    """
    Every string on the alert that could carry a fault identity, best first.

    The device's own raw `type` is preferred over the adapter's canonical
    `errorCode` because the canonicalisation is deliberately lossy — the
    adapter folds LIDAR_SAFETY_TRIP into OBSTRUCTION_DETECTED, for instance,
    which is the right yard-model bucket but the wrong problem family. Alerts
    that arrive already in Stage 1 canonical form carry no `_originalRaw`, so
    they fall through to errorCode as before.
    """
    raw = alert.get("_originalRaw") or {}
    candidates = [
        raw.get("type"),
        raw.get("errorCode"),
        alert.get("errorCode"),
        alert.get("type"),
        alert.get("eciEvent"),
    ]
    return [str(c).strip().upper() for c in candidates if c]


def _search_text(alert: Dict[str, Any]) -> str:
    raw = alert.get("_originalRaw") or {}
    parts = _candidate_codes(alert) + [str(raw.get("message") or ""), str(alert.get("message") or "")]
    return " ".join(parts).lower()


def problem_type(alert: Dict[str, Any]) -> str:
    """
    The problem family this alert belongs to. Never raises and never returns
    None — an unrecognised alert is UNCLASSIFIED, which keeps it a singleton.
    """
    for code in _candidate_codes(alert):
        family = TYPE_TO_FAMILY.get(code)
        if family:
            return family

    text = _search_text(alert)
    for keywords, family in KEYWORD_RULES:
        if any(kw in text for kw in keywords):
            return family

    return UNCLASSIFIED


def same_problem_type(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    """
    True only when both alerts share a family that is allowed to agglomerate.
    Two UNCLASSIFIED alerts are NOT the same problem — they are two separate
    unknowns, so this returns False and both stay singletons.
    """
    fam_a = problem_type(a)
    if fam_a in SINGLETON_FAMILIES:
        return False
    return fam_a == problem_type(b)


def dominant_problem_type(group: List[Dict[str, Any]]) -> str:
    """The family that most members of a group carry; ties broken alphabetically."""
    if not group:
        return UNCLASSIFIED
    counts: Dict[str, int] = {}
    for alert in group:
        family = problem_type(alert)
        counts[family] = counts.get(family, 0) + 1
    return max(sorted(counts), key=lambda f: counts[f])


# ---- Routing -----------------------------------------------------------------
# Which investigator domain owns which problem family. This replaces the
# hardcoded CLUSTER-A/B/C/D -> agent table that used to live in
# backend/agent/coordinator.py: routing is now a property of the problem, so a
# cluster the system has never seen before still routes somewhere sensible.
DOMAIN_OF_PROBLEM_TYPE: Dict[str, str] = {
    TRAFFIC_FLOW: "lane_investigator",
    MECHANICAL_ACTUATOR: "lane_investigator",
    PERCEPTION_SAFETY: "lane_investigator",
    CRANE_HANDOFF: "lane_investigator",
    POWER_CHARGING: "power_investigator",
    FLEET_BATTERY: "fleet_power_investigator",
    COMMS_NAVIGATION: "general_investigator",
    ENVIRONMENT: "general_investigator",
    UNCLASSIFIED: "general_investigator",
}

# Public agent names, kept in the same `Agent_N_Name` style the incident_clusters
# table already uses so existing UI badges keep rendering unchanged.
AGENT_OF_DOMAIN: Dict[str, str] = {
    "lane_investigator": "Agent_1_LaneInvestigator",
    "power_investigator": "Agent_2_BCSSInvestigator",
    "fleet_power_investigator": "Agent_3_FleetPowerInvestigator",
    "general_investigator": "Agent_4_GeneralInvestigator",
}

DEFAULT_DOMAIN = "general_investigator"


def domain_for(problem_family: Optional[str]) -> str:
    return DOMAIN_OF_PROBLEM_TYPE.get(problem_family or "", DEFAULT_DOMAIN)


def agent_for(problem_family: Optional[str]) -> str:
    return AGENT_OF_DOMAIN[domain_for(problem_family)]


def cluster_name(problem_family: str, named_feature: str, alert_count: int) -> str:
    """
    Generated incident title, e.g. "Lane 7 mainline - Traffic Flow Blockage".
    Single-alert incidents say so, because an operator reading a docket should
    be able to tell a correlated incident from a lone unexplained alert.
    """
    label = PROBLEM_TYPE_LABEL.get(problem_family, PROBLEM_TYPE_LABEL[UNCLASSIFIED])
    if alert_count <= 1:
        return f"{named_feature} - {label} (single alert)"
    return f"{named_feature} - {label}"
