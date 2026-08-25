"""
mcp-terminal-telemetry Server

Provides time-series, operational, and diagnostic telemetry from Fleet Management Systems (FMS),
Automated Transporter Trucks (ATT), and Battery Change/Charging Stations (BCSS) directly from Supabase,
supporting Navis N4 and VDA5050 telemetry standards.
"""

from typing import Any, Dict, Optional
from fastmcp import FastMCP
from supabase_client import get_supabase_client
from security import secure_audit_tool

SERVER_NAME = "mcp-terminal-telemetry"

# Initialize FastMCP Server
mcp = FastMCP(
    name=SERVER_NAME,
)


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


if __name__ == "__main__":
    mcp.run(transport="stdio")
