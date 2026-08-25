"""
mcp-terminal-diagnostics Server

Interfaces with programmable logic controllers (PLCs) and enterprise maintenance databases directly via Supabase,
protected by enterprise RBAC and audit logging.
"""

from typing import Any, Dict, List, Optional
from fastmcp import FastMCP
from supabase_client import get_supabase_client
from security import secure_audit_tool

SERVER_NAME = "mcp-terminal-diagnostics"

# Initialize FastMCP Server
mcp = FastMCP(
    name=SERVER_NAME,
)


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


if __name__ == "__main__":
    mcp.run(transport="stdio")
