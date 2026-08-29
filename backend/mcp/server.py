"""
Unified PSA Port Terminal FastMCP Server

Consolidates:
1. mcp-terminal-telemetry: SCADA telemetry, AGV metrics, BCSS charger telemetry, and lane queues
2. mcp-terminal-diagnostics: PLC fault code lookups, asset maintenance history, and topology relationships
3. mcp-docket-service: Human review docket publishing

All tools retain enterprise RBAC enforcement and Supabase audit logging.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from fastmcp import FastMCP

from security import secure_audit_tool
from supabase_client import get_supabase_client

SERVER_NAME = "psa-unified-mcp"

# Initialize single consolidated FastMCP Server
mcp = FastMCP(
    name=SERVER_NAME,
)

# Storage for committed review dockets
DOCKET_STORE: Dict[str, Dict[str, Any]] = {}


# ============================================================================
# 1. Telemetry Tools (SCADA / FMS / VDA5050 / BCSS)
# ============================================================================

@mcp.tool()
@secure_audit_tool(SERVER_NAME, "get_lane_lead_agv")
def get_lane_lead_agv(lane_id: str, actor_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Queries spatial queue data for a given transport lane to identify the blocking/lead vehicle at the head of the line.

    Args:
        lane_id: Unique identifier for the lane (e.g., 'LANE-7' or 'Lane_7').
        actor_context: Security context dictionary containing user_id, user_email, user_role, client_ip.

    Returns:
        JSON object containing lane_id, lead_vehicle_id, blocked_vehicles list, and queue status ('BLOCKED' | 'FLOWING' | 'SLOWED').
    """
    client = get_supabase_client()
    response = client.table("lane_queues").select("*").eq("lane_id", lane_id).execute()

    if not response.data:
        return {
            "error": f"Lane '{lane_id}' not found in database.",
            "lane_id": lane_id,
            "status": "NOT_FOUND",
        }

    row = response.data[0]
    lead_id = row.get("lead_vehicle_id") or row.get("lead_agv_id")
    return {
        "lane_id": row.get("lane_id", lane_id),
        "lead_vehicle_id": lead_id,
        "lead_agv_id": lead_id,  # backward compatibility
        "blocked_vehicles": row.get("blocked_vehicles", []),
        "status": row.get("status", "CLEAR"),
        "headway_distance_m": float(row.get("headway_distance_m", 0.0)),
    }


@mcp.tool()
@secure_audit_tool(SERVER_NAME, "get_agv_telemetry")
def get_agv_telemetry(vehicle_id: str = None, agv_id: str = None, actor_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Retrieves real-time sensor metrics, Navis N4 work assignment states (wa_id, wi_status),
    VDA5050 driving/load states, hydraulic state, motor currents, and error register flags for an ATT/AGV.

    Args:
        vehicle_id: Vehicle ID in Navis N4 ATT format (e.g., 'ATT-142').
        agv_id: Alternative parameter name for vehicle ID (e.g., 'AGV-104').
        actor_context: Security context dictionary containing user_id, user_email, user_role, client_ip.

    Returns:
        JSON object containing vehicle_id, wa_id, wi_status, load_state, driving_state,
        protective_field_violation, speed_mps, twistlock_sensor, twistlock_command,
        hydraulic_pressure_bar, error_register, battery_soc_percent, motor_temp_c.
    """
    target_id = vehicle_id or agv_id
    if not target_id:
        return {
            "error": "Missing required parameter 'vehicle_id' or 'agv_id'.",
            "status": "INVALID_INPUT"
        }

    client = get_supabase_client()
    response = client.table("agv_telemetry").select("*").eq("vehicle_id", target_id).execute()

    if not response.data:
        return {
            "error": f"Vehicle '{target_id}' not found in database.",
            "vehicle_id": target_id,
            "status": "NOT_FOUND",
        }

    row = response.data[0]
    return {
        "vehicle_id": row.get("vehicle_id", target_id),
        "agv_id": row.get("vehicle_id", target_id),  # backward compatibility
        "wa_id": row.get("wa_id"),
        "wi_status": row.get("wi_status", "IN_PROGRESS"),
        "load_state": row.get("load_state", "LOADED"),
        "driving_state": row.get("driving_state", "STOPPED"),
        "protective_field_violation": bool(row.get("protective_field_violation", False)),
        "speed_mps": float(row.get("speed_mps", 0.0)),
        "twistlock_sensor": row.get("twistlock_sensor", "UNKNOWN"),
        "twistlock_command": row.get("twistlock_command", "IDLE"),
        "hydraulic_pressure_bar": float(row.get("hydraulic_pressure_bar", 0.0)),
        "error_register": row.get("error_register", "NONE"),
        "battery_soc_percent": float(row.get("battery_soc_percent", 0.0)),
        "motor_temp_c": float(row.get("motor_temp_c", 0.0)),
    }


@mcp.tool()
@secure_audit_tool(SERVER_NAME, "get_vehicle_telemetry")
def get_vehicle_telemetry(vehicle_id: str, actor_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Alias for get_agv_telemetry using Navis N4 vehicle_id terminology.
    """
    return get_agv_telemetry(vehicle_id=vehicle_id, actor_context=actor_context)


@mcp.tool()
@secure_audit_tool(SERVER_NAME, "get_bcss_charger_status")
def get_bcss_charger_status(station_id: str, actor_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Queries electrical and thermal telemetry for a Battery Change/Charging Station (BCSS).

    Args:
        station_id: Station ID (e.g., 'BCSS-02').
        actor_context: Security context dictionary containing user_id, user_email, user_role, client_ip.

    Returns:
        JSON object containing station_id, breaker_state, bus_temperature_c, voltage_v, current_a, and trip_reason.
    """
    client = get_supabase_client()
    response = client.table("bcss_chargers").select("*").eq("station_id", station_id).execute()

    if not response.data:
        return {
            "error": f"Charging station '{station_id}' not found in database.",
            "station_id": station_id,
            "status": "NOT_FOUND",
        }

    row = response.data[0]
    return {
        "station_id": row.get("station_id", station_id),
        "breaker_state": row.get("breaker_state", "UNKNOWN"),
        "bus_temperature_c": float(row.get("bus_temperature_c", 0.0)),
        "voltage_v": float(row.get("voltage_v", 0.0)),
        "current_a": float(row.get("current_a", 0.0)),
        "trip_reason": row.get("trip_reason") or "NONE",
    }


# ============================================================================
# 2. Diagnostics & Maintenance Tools (PLCs / Impact Analysis)
# ============================================================================

@mcp.tool()
@secure_audit_tool(SERVER_NAME, "decode_plc_fault_code")
def decode_plc_fault_code(
    fault_code: str,
    actor_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Decodes PLC fault codes and error registers into diagnostic explanations, possible causes, and remediation guidance.

    Args:
        fault_code: Fault code or error register string (e.g., 'SPREADER_LOCK_FAULT', 'BCSS_CHARGER_TRIP', 'ERR_TWISTLOCK_TIMEOUT').
        actor_context: Security context dictionary containing user_id, user_email, user_role, client_ip.

    Returns:
        JSON object containing fault_code, hex_code, device_type, description, possible_causes, and recommended_action.
    """
    client = get_supabase_client()
    res = client.table("plc_fault_codes").select("*").eq("fault_code", fault_code).execute()

    if not res.data:
        return {
            "error": f"PLC fault code '{fault_code}' not found in database.",
            "fault_code": fault_code,
            "status": "NOT_FOUND",
        }

    return res.data[0]


@mcp.tool()
@secure_audit_tool(SERVER_NAME, "lookup_plc_fault_code")
def lookup_plc_fault_code(
    fault_code: str,
    actor_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Alias for decode_plc_fault_code. Decodes PLC fault code from error registers.

    Args:
        fault_code: Fault code string.
        actor_context: Security context dictionary containing user_id, user_email, user_role, client_ip.
    """
    return decode_plc_fault_code(fault_code=fault_code, actor_context=actor_context)


@mcp.tool()
@secure_audit_tool(SERVER_NAME, "get_maintenance_history")
def get_maintenance_history(
    asset_id: str,
    actor_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Retrieves recent maintenance logs, component replacements, and service events for an asset (ATT or Charging Station).
    Requires LANE_OPERATIONS_ENGINEER or SYSTEM_COORDINATOR role.

    Args:
        asset_id: Unique asset ID (e.g., 'ATT-142', 'BCSS-02').
        actor_context: Security context dictionary containing user_id, user_email, user_role, client_ip.

    Returns:
        JSON object containing asset_id, records list, and total count.
    """
    client = get_supabase_client()
    res = client.table("maintenance_records").select("*").eq("asset_id", asset_id).order("timestamp", desc=True).execute()

    if not res.data:
        return {
            "asset_id": asset_id,
            "records": [],
            "count": 0,
            "status": "NOT_FOUND",
            "message": f"No maintenance records found for asset '{asset_id}'.",
        }

    return {
        "asset_id": asset_id,
        "records": res.data,
        "count": len(res.data),
        "status": "SUCCESS",
    }


@mcp.tool()
@secure_audit_tool(SERVER_NAME, "get_asset_impact")
def get_asset_impact(
    asset_id: str,
    actor_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Retrieves upstream and downstream topological impact across the terminal layout for an impacted asset.
    Requires LANE_OPERATIONS_ENGINEER or SYSTEM_COORDINATOR role.

    Args:
        asset_id: Asset identifier (e.g., 'LANE-7', 'Lane_7', 'BCSS-02').
        actor_context: Security context dictionary containing user_id, user_email, user_role, client_ip.

    Returns:
        JSON object containing asset_id, asset_type, upstream_dependencies, downstream_impact, and operational_impact_summary.
    """
    client = get_supabase_client()
    res = client.table("asset_relationships").select("*").eq("asset_id", asset_id).execute()

    if not res.data:
        return {
            "error": f"Asset '{asset_id}' relationship topology not found in database.",
            "asset_id": asset_id,
            "status": "NOT_FOUND",
        }

    return res.data[0]


@mcp.tool()
@secure_audit_tool(SERVER_NAME, "get_asset_relationships")
def get_asset_relationships(
    asset_id: str,
    actor_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Alias for get_asset_impact. Retrieves topological asset relationships.

    Args:
        asset_id: Asset identifier.
        actor_context: Security context dictionary containing user_id, user_email, user_role, client_ip.
    """
    return get_asset_impact(asset_id=asset_id, actor_context=actor_context)


# ============================================================================
# 3. Docket Tools (Review Queue Publishing)
# ============================================================================

@mcp.tool()
@secure_audit_tool(SERVER_NAME, "submit_incident_docket")
def submit_incident_docket(
    incidents: List[Dict[str, Any]],
    actor_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Compiles synthesized incident analyses, telemetry summaries, root causes, and operator recommendations into a single review dossier.
    Requires SYSTEM_COORDINATOR role.

    Args:
        incidents: List of incident dictionaries. Each incident object must contain:
            - incident_id (str): Unique incident identifier (e.g., 'INC-2026-001')
            - cluster_name (str): Cluster title (e.g., 'Lane 7 Bottleneck')
            - root_cause (str): Primary diagnostic root cause
            - evidence (dict): Supporting telemetry and diagnostic proof metrics
            - recommended_action (str): Proposed remediation for terminal operator
        actor_context: Security context dictionary containing user_id, user_email, user_role, client_ip.

    Returns:
        JSON object containing docket_id, status ('CREATED'), and ISO-8601 timestamp.
    """
    if not incidents or not isinstance(incidents, list):
        return {
            "error": "Submission failed: 'incidents' must be a non-empty list of incident records.",
            "status": "VALIDATION_FAILED",
        }

    required_fields = ["incident_id", "cluster_name", "root_cause", "evidence", "recommended_action"]
    for idx, inc in enumerate(incidents):
        if not isinstance(inc, dict):
            return {
                "error": f"Submission failed: incident at index {idx} must be a JSON object/dict.",
                "status": "VALIDATION_FAILED",
            }
        missing = [f for f in required_fields if f not in inc or inc[f] is None]
        if missing:
            return {
                "error": f"Submission failed: incident at index {idx} is missing required fields: {', '.join(missing)}.",
                "status": "VALIDATION_FAILED",
            }

    docket_id = f"DOCKET-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
    timestamp = datetime.now(timezone.utc).isoformat()

    docket_entry = {
        "docket_id": docket_id,
        "status": "CREATED",
        "timestamp": timestamp,
        "incidents": incidents,
        "submitted_by": actor_context.get("user_email") if actor_context else None,
    }

    DOCKET_STORE[docket_id] = docket_entry

    return {
        "docket_id": docket_id,
        "status": "CREATED",
        "timestamp": timestamp,
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
