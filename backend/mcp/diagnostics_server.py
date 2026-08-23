"""
mcp-terminal-diagnostics Server

Interfaces with programmable logic controllers (PLCs) and enterprise maintenance databases directly via Supabase.
"""

from typing import Any, Dict, List
from fastmcp import FastMCP
from supabase_client import get_supabase_client

# Initialize FastMCP Server
mcp = FastMCP(
    name="mcp-terminal-diagnostics",
)


@mcp.tool()
def decode_plc_fault_code(fault_code: str) -> Dict[str, Any]:
    """
    Decodes PLC fault codes and error registers into diagnostic explanations, possible causes, and remediation guidance.

    Args:
        fault_code: Fault code or error register string (e.g., 'ERR_TWISTLOCK_TIMEOUT', 'OVERTEMP_THERMAL_CUTOFF').

    Returns:
        JSON object containing fault_code, hex_code, device_type, description, possible_causes, and recommended_action.
        If not found or error occurs, returns a structured error object.
    """
    try:
        client = get_supabase_client()
        res = client.table("plc_fault_codes").select("*").eq("fault_code", fault_code).execute()
        
        if not res.data:
            return {
                "error": f"PLC fault code '{fault_code}' not found in database.",
                "fault_code": fault_code,
                "status": "NOT_FOUND"
            }

        return res.data[0]
    except Exception as e:
        return {
            "error": f"Failed to query PLC fault code '{fault_code}': {str(e)}",
            "fault_code": fault_code,
            "status": "ERROR"
        }


@mcp.tool()
def get_maintenance_history(asset_id: str) -> Dict[str, Any]:
    """
    Retrieves recent maintenance logs, component replacements, and service events for an asset (AGV or Charging Station).

    Args:
        asset_id: Unique asset ID (e.g., 'AGV-104', 'BCSS-02').

    Returns:
        JSON object containing asset_id, records list, and total count.
        If not found or error occurs, returns a structured error object.
    """
    try:
        client = get_supabase_client()
        res = client.table("maintenance_records").select("*").eq("asset_id", asset_id).order("timestamp", desc=True).execute()
        
        if not res.data:
            return {
                "asset_id": asset_id,
                "records": [],
                "count": 0,
                "status": "NOT_FOUND",
                "message": f"No maintenance records found for asset '{asset_id}'."
            }

        return {
            "asset_id": asset_id,
            "records": res.data,
            "count": len(res.data),
            "status": "SUCCESS"
        }
    except Exception as e:
        return {
            "error": f"Failed to retrieve maintenance history for '{asset_id}': {str(e)}",
            "asset_id": asset_id,
            "status": "ERROR"
        }


@mcp.tool()
def get_asset_impact(asset_id: str) -> Dict[str, Any]:
    """
    Retrieves upstream and downstream topological impact across the terminal layout for an impacted asset.

    Args:
        asset_id: Asset identifier (e.g., 'Lane_7', 'BCSS-02').

    Returns:
        JSON object containing asset_id, asset_type, upstream_dependencies, downstream_impact, and operational_impact_summary.
        If not found or error occurs, returns a structured error object.
    """
    try:
        client = get_supabase_client()
        res = client.table("asset_relationships").select("*").eq("asset_id", asset_id).execute()
        
        if not res.data:
            return {
                "error": f"Asset '{asset_id}' relationship topology not found in database.",
                "asset_id": asset_id,
                "status": "NOT_FOUND"
            }

        return res.data[0]
    except Exception as e:
        return {
            "error": f"Failed to retrieve asset impact for '{asset_id}': {str(e)}",
            "asset_id": asset_id,
            "status": "ERROR"
        }


if __name__ == "__main__":
    mcp.run(transport="stdio")
