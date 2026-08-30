"""
Alert Normalization & Adapter Layer.

Transforms various incoming alert structures (Supabase raw_alerts database rows,
Navis N4/VDA5050 SCADA streams, or IoT telemetry dictionaries) into the canonical
Stage 1 alert format required by the clustering engine.
"""

import re
from typing import Any, Dict, List, Optional, Tuple
from . import yard

# Noise types that can be filtered out during deterministic Stage 1 noise reduction
NOISE_SEVERITIES = {"INFO", "NOMINAL"}
NOISE_ALERT_TYPES = {
    "WIND_GUST_ADVISORY",
    "REEFER_TEMP_NORMAL",
    "SESSION_COMPLETED",
    "NOISE_FILTERED",
    "CYCLE_COMPLETE",
}

# Coordinate defaults for known terminal locations
LOCATION_COORDS: Dict[str, Dict[str, float]] = {
    "Lane_7": {"x": 455.0, "y": 118.0},
    "LANE-7": {"x": 455.0, "y": 118.0},
    "Lane_4": {"x": 220.0, "y": 180.0},
    "LANE-4": {"x": 220.0, "y": 180.0},
    "Lane_3": {"x": 300.0, "y": 180.0},
    "LANE-3": {"x": 300.0, "y": 180.0},
    "Station_BCSS_02": {"x": 298.0, "y": 62.0},
    "BCSS-02": {"x": 298.0, "y": 62.0},
    "Station_BCSS_01": {"x": 150.0, "y": 80.0},
    "BCSS-01": {"x": 150.0, "y": 80.0},
    "Sector_A": {"x": 480.0, "y": 80.0},
    "SECTOR-A": {"x": 480.0, "y": 80.0},
    "Berth_01": {"x": 150.0, "y": 400.0},
    "Berth_02": {"x": 350.0, "y": 400.0},
    "Berth_03": {"x": 550.0, "y": 400.0},
    "Terminal_Wide": {"x": 425.0, "y": 240.0},
}

# Vehicle slot offsets for spatial positioning
VEHICLE_POSITIONS: Dict[str, Dict[str, float]] = {
    "AGV-104": {"x": 412.5, "y": 118.2},
    "ATT-142": {"x": 412.5, "y": 118.2},
    "AGV-109": {"x": 408.0, "y": 118.0},
    "ATT-089": {"x": 408.0, "y": 118.0},
    "AGV-112": {"x": 405.0, "y": 118.0},
    "ATT-112": {"x": 405.0, "y": 118.0},
    "AGV-088": {"x": 298.0, "y": 62.0},
    "ATT-311": {"x": 298.0, "y": 62.0},
    "AGV-072": {"x": 480.0, "y": 80.0},
    "AGV-055": {"x": 220.0, "y": 180.0},
    "ATT-055": {"x": 220.0, "y": 180.0},
    "AGV-201": {"x": 150.0, "y": 80.0},
}


def is_noise_alert(record: Dict[str, Any]) -> bool:
    """Identifies informational or nominal noise that can be filtered deterministically."""
    sev = str(record.get("severity", "")).upper()
    alert_type = str(record.get("type", record.get("errorCode", ""))).upper()
    if sev in NOISE_SEVERITIES or alert_type in NOISE_ALERT_TYPES:
        return True
    return False


def normalize_db_alert(
    row: Dict[str, Any],
    telemetry_map: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Transforms a Supabase raw_alerts row (columns: id, timestamp, source, type,
    location, severity) into a Stage 1 canonical alert format.

    `message` is ignored on purpose — see the note in the body.
    """
    # If it's already in Stage 1 canonical format (e.g. from JSON file), pass through
    if "alertId" in row and "raisedAt" in row and "position" in row:
        return row

    alert_id = row.get("id") or row.get("alertId") or "ALT-UNKNOWN"
    timestamp = row.get("timestamp") or row.get("raisedAt") or "2026-08-24T14:30:00Z"
    source = row.get("source", "")
    alert_type = row.get("type") or row.get("errorCode") or "UNKNOWN_FAULT"
    location_str = row.get("location") or "YARD"
    severity = str(row.get("severity", "MEDIUM")).upper()

    # `message` is deliberately not read here. It is a human-written summary
    # that states the diagnosis outright ("Twistlock release actuator timed
    # out"), so anything derived from it would leak the answer into clustering
    # and, through the incident name, into every agent prompt downstream. The
    # column can be dropped entirely without changing this function's output —
    # see backend/sql/006_drop_raw_alert_message.sql.

    # 1. Determine vehicle ID from the emitting source or the location
    vehicle_id = None
    if source.startswith("AGV-") or source.startswith("ATT-"):
        vehicle_id = source.replace("AGV-", "ATT-")  # Aligns to Navis N4 ATT naming
    elif re.search(r"(AGV-\d+|ATT-\d+)", source):
        m = re.search(r"(AGV-\d+|ATT-\d+)", source)
        if m:
            vehicle_id = m.group(1).replace("AGV-", "ATT-")
    elif "Lane_7" in location_str or "LANE-7" in location_str or "LANE_7" in source:
        vehicle_id = "ATT-104"
    elif "Station_BCSS_02" in location_str or "BCSS-02" in source:
        vehicle_id = "ATT-088"
    elif "Lane_4" in location_str or "LANE_4" in source:
        vehicle_id = "ATT-055"

    # 2. Determine shared resource & zone
    canonical_res = yard.canonical_resource_id(location_str)
    if not canonical_res and vehicle_id:
        if "104" in vehicle_id or "142" in vehicle_id or "109" in vehicle_id or "112" in vehicle_id:
            canonical_res = "JUNCTION-L7-A"
        elif "088" in vehicle_id or "311" in vehicle_id:
            canonical_res = "CHARGER-B3"
        elif "055" in vehicle_id:
            canonical_res = "LANE-4"

    res_obj = None
    if canonical_res:
        res_obj = {"id": canonical_res, "type": yard.resource_type(canonical_res)}

    zone_id = yard.ZONE_OF.get(canonical_res, location_str) if canonical_res else location_str

    # 3. Determine coordinates
    pos = {"x": 425.0, "y": 240.0}
    orig_vid = vehicle_id.replace("ATT-", "AGV-") if vehicle_id else None
    if orig_vid and orig_vid in VEHICLE_POSITIONS:
        pos = dict(VEHICLE_POSITIONS[orig_vid])
    elif vehicle_id and vehicle_id in VEHICLE_POSITIONS:
        pos = dict(VEHICLE_POSITIONS[vehicle_id])
    elif canonical_res and yard.resource_point(canonical_res):
        pt = yard.resource_point(canonical_res)
        pos = {"x": pt[0], "y": pt[1]}
    elif location_str in LOCATION_COORDS:
        pos = dict(LOCATION_COORDS[location_str])

    # 4. Map fault codes & channel
    is_safety = severity == "CRITICAL" and (
        "LIDAR_SAFETY" in alert_type
        or "SAFETY_FIELD" in alert_type
        or "SAFETY" in alert_type
        or "EMERGENCY_STOP" in alert_type
    )
    channel = "safety" if is_safety else "telemetry"

    # Map alert type to canonical fault
    error_code = alert_type
    if alert_type == "TWISTLOCK_TIMEOUT" or alert_type == "ACTUATOR_ERR":
        error_code = "SPREADER_LOCK_FAULT"
    elif alert_type == "TRAFFIC_CONGESTION" or alert_type == "HEADWAY_VIOLATION":
        error_code = "JUNCTION_CONTENTION" if "LANE-7" in zone_id or "JUNCTION" in (canonical_res or "") else "OBSTRUCTION_DETECTED"
    elif alert_type == "BREAKER_TRIPPED" or alert_type == "OVERTEMP_WARNING" or alert_type == "VOLTAGE_DROP":
        error_code = "BCSS_CHARGER_TRIP"
    elif alert_type == "FEEDER_STARVATION":
        error_code = "CRANE_HANDOFF_MISMATCH"
    elif alert_type == "LIDAR_SAFETY_TRIP":
        error_code = "SAFETY_FIELD_VIOLATION" if is_safety else "OBSTRUCTION_DETECTED"
    elif alert_type in NOISE_ALERT_TYPES or severity in NOISE_SEVERITIES:
        error_code = None  # State-only or noise

    # 5. Enrich state from telemetry if available
    tel = {}
    if telemetry_map and vehicle_id:
        tel = telemetry_map.get(vehicle_id) or telemetry_map.get(orig_vid, {})

    battery = tel.get("battery_soc_percent") or (12 if "088" in (vehicle_id or "") else 65)
    load_state = tel.get("load_state") or ("LOADED" if ("104" in (vehicle_id or "") or "142" in (vehicle_id or "")) else "EMPTY")
    driving_state = tel.get("driving_state") or "STOPPED"
    conn_state = "OFFLINE" if "COMMS" in alert_type else "ONLINE"
    protective = bool(tel.get("protective_field_violation") or is_safety)

    crane_match = re.search(r"(QC-\d+)", f"{source} {location_str}")
    crane_id = crane_match.group(1) if crane_match else None

    return {
        "alertId": alert_id,
        "channel": channel,
        "eciEvent": "ECI_SAFETY_FIELD_TRIPPED" if is_safety else "ECI_AGV_STATUS_UPDATED",
        "raisedAt": timestamp,
        "vehicleId": vehicle_id or "ATT-STATIC",
        "errorCode": error_code,
        "zoneId": zone_id,
        "position": pos,
        "sharedResource": res_obj,
        "workAssignment": {
            "waId": tel.get("wa_id") or "WA-88214",
            "wiStatus": tel.get("wi_status") or "PENDING_REJECTION",
        },
        "state": {
            "batteryPct": float(battery),
            "loadState": str(load_state),
            "drivingState": str(driving_state),
            "connectionState": conn_state,
            "protectiveFieldViolation": protective,
        },
        "resourceRefs": ({"craneId": crane_id} if crane_id else {}),
        "_originalRaw": row,
    }


def normalize_alert_batch(
    rows: List[Dict[str, Any]],
    telemetry_rows: Optional[List[Dict[str, Any]]] = None,
    filter_noise: bool = False,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Normalizes a list of raw database rows.
    Returns (valid_alerts, filtered_noise_alerts).
    """
    tel_map: Dict[str, Dict[str, Any]] = {}
    if telemetry_rows:
        for t in telemetry_rows:
            vid = t.get("vehicle_id") or t.get("agv_id")
            if vid:
                tel_map[vid] = t
                tel_map[vid.replace("AGV-", "ATT-")] = t
                tel_map[vid.replace("ATT-", "AGV-")] = t

    normalized: List[Dict[str, Any]] = []
    noise: List[Dict[str, Any]] = []

    for r in rows:
        if filter_noise and is_noise_alert(r):
            noise.append(r)
        else:
            normalized.append(normalize_db_alert(r, tel_map))

    return normalized, noise
