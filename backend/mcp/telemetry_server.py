"""
mcp-terminal-telemetry Server

Provides time-series, operational, and diagnostic telemetry from Fleet Management Systems (FMS),
AGVs, and Battery Change/Charging Stations (BCSS) directly from the live Supabase database.
"""

from typing import Any, Dict
from fastmcp import FastMCP
from supabase_client import get_supabase_client

# Initialize FastMCP Server
mcp = FastMCP(
    name="mcp-terminal-telemetry",
)


@mcp.tool()
def get_lane_lead_agv(lane_id: str) -> Dict[str, Any]:
    """
    Queries spatial queue data for a given transport lane to identify the blocking/lead AGV at the head of the line.

    Args:
        lane_id: Unique identifier for the lane (e.g., 'Lane_7').

    Returns:
        JSON object containing lane_id, lead_agv_id, blocked_vehicles list, and queue status ('BLOCKED' | 'FLOWING' | 'SLOWED').
        If not found or error occurs, returns a structured error object.
    """
    try:
        client = get_supabase_client()
        response = client.table("lane_queues").select("*").eq("lane_id", lane_id).execute()
        
        if not response.data:
            return {
                "error": f"Lane '{lane_id}' not found in database.",
                "lane_id": lane_id,
                "status": "NOT_FOUND"
            }

        row = response.data[0]
        return {
            "lane_id": row.get("lane_id", lane_id),
            "lead_agv_id": row.get("lead_agv_id"),
            "blocked_vehicles": row.get("blocked_vehicles", []),
            "status": row.get("status", "CLEAR"),
            "headway_distance_m": float(row.get("headway_distance_m", 0.0))
        }
    except Exception as e:
        return {
            "error": f"Failed to query lane queue telemetry for '{lane_id}': {str(e)}",
            "lane_id": lane_id,
            "status": "ERROR"
        }


@mcp.tool()
def get_agv_telemetry(agv_id: str) -> Dict[str, Any]:
    """
    Retrieves real-time sensor metrics, hydraulic state, motor currents, and error register flags for a specific AGV.

    Args:
        agv_id: Vehicle ID (e.g., 'AGV-104').

    Returns:
        JSON object containing agv_id, speed_mps, twistlock_sensor state, twistlock_command, hydraulic_pressure_bar, error_register, battery_soc_percent, and motor_temp_c.
        If not found or error occurs, returns a structured error object.
    """
    try:
        client = get_supabase_client()
        response = client.table("agv_telemetry").select("*").eq("agv_id", agv_id).execute()
        
        if not response.data:
            return {
                "error": f"AGV '{agv_id}' not found in database.",
                "agv_id": agv_id,
                "status": "NOT_FOUND"
            }

        row = response.data[0]
        return {
            "agv_id": row.get("agv_id", agv_id),
            "speed_mps": float(row.get("speed_mps", 0.0)),
            "twistlock_sensor": row.get("twistlock_sensor", "UNKNOWN"),
            "twistlock_command": row.get("twistlock_command", "IDLE"),
            "hydraulic_pressure_bar": float(row.get("hydraulic_pressure_bar", 0.0)),
            "error_register": row.get("error_register", "NONE"),
            "battery_soc_percent": float(row.get("battery_soc_percent", 0.0)),
            "motor_temp_c": float(row.get("motor_temp_c", 0.0))
        }
    except Exception as e:
        return {
            "error": f"Failed to query AGV telemetry for '{agv_id}': {str(e)}",
            "agv_id": agv_id,
            "status": "ERROR"
        }


@mcp.tool()
def get_bcss_charger_status(station_id: str) -> Dict[str, Any]:
    """
    Queries electrical and thermal telemetry for a Battery Change/Charging Station (BCSS).

    Args:
        station_id: Station ID (e.g., 'BCSS-02').

    Returns:
        JSON object containing station_id, breaker_state, bus_temperature_c, voltage_v, current_a, and trip_reason.
        If not found or error occurs, returns a structured error object.
    """
    try:
        client = get_supabase_client()
        response = client.table("bcss_chargers").select("*").eq("station_id", station_id).execute()
        
        if not response.data:
            return {
                "error": f"Charging station '{station_id}' not found in database.",
                "station_id": station_id,
                "status": "NOT_FOUND"
            }

        row = response.data[0]
        return {
            "station_id": row.get("station_id", station_id),
            "breaker_state": row.get("breaker_state", "UNKNOWN"),
            "bus_temperature_c": float(row.get("bus_temperature_c", 0.0)),
            "voltage_v": float(row.get("voltage_v", 0.0)),
            "current_a": float(row.get("current_a", 0.0)),
            "trip_reason": row.get("trip_reason") or "NONE"
        }
    except Exception as e:
        return {
            "error": f"Failed to query charger status for '{station_id}': {str(e)}",
            "station_id": station_id,
            "status": "ERROR"
        }


if __name__ == "__main__":
    mcp.run(transport="stdio")
