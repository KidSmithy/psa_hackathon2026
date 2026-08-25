"""
Enterprise Security, RBAC & Audit Logging for MCP Servers

Implements role-based access control, latency tracking, and persistent audit logging to Supabase
for all Model Context Protocol (MCP) tool invocations.
"""

from functools import wraps
import inspect
import time
from typing import Any, Callable, Dict, Optional, Set
from pydantic import BaseModel, Field
from supabase_client import get_supabase_client

# Access Control (RBAC) Permissions Matrix
RBAC_PERMISSIONS: Dict[str, Set[str]] = {
    "AGENT_INVESTIGATOR": {
        "get_lane_lead_agv",
        "get_agv_telemetry",
        "get_bcss_charger_status",
        "lookup_plc_fault_code",
        "decode_plc_fault_code",
    },
    "LANE_OPERATIONS_ENGINEER": {
        "get_lane_lead_agv",
        "get_agv_telemetry",
        "get_bcss_charger_status",
        "lookup_plc_fault_code",
        "decode_plc_fault_code",
        "get_maintenance_history",
        "get_asset_relationships",
        "get_asset_impact",
    },
    "SYSTEM_COORDINATOR": {
        "get_lane_lead_agv",
        "get_agv_telemetry",
        "get_bcss_charger_status",
        "lookup_plc_fault_code",
        "decode_plc_fault_code",
        "get_maintenance_history",
        "get_asset_relationships",
        "get_asset_impact",
        "submit_incident_docket",
    },
    "RESTRICTED_VIEWER": {
        "get_lane_lead_agv",
        "get_bcss_charger_status",
    },
}


class AuditLogEntry(BaseModel):
    user_id: str
    user_email: str
    user_role: str
    server_name: str
    tool_name: str
    parameters: Dict[str, Any]
    execution_time_ms: float
    status: str
    client_ip: Optional[str] = "127.0.0.1"


def write_audit_log(entry: AuditLogEntry) -> None:
    """Inserts a structured audit log entry directly into Supabase mcp_audit_logs table."""
    client = get_supabase_client()
    client.table("mcp_audit_logs").insert(entry.model_dump()).execute()


def is_role_permitted(user_role: str, tool_name: str) -> bool:
    """Verifies whether the given user_role is authorized to invoke tool_name."""
    permitted_tools = RBAC_PERMISSIONS.get(user_role, set())
    return tool_name in permitted_tools


def secure_audit_tool(server_name: str, tool_name: str) -> Callable:
    """
    Unified decorator enforcing RBAC authentication, execution latency measurement,
    and automated Supabase audit log persistence without try-except blocks.
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            start_time = time.perf_counter()

            # Extract actor context from kwargs or args
            sig = inspect.signature(func)
            bound_args = sig.bind(*args, **kwargs)
            bound_args.apply_defaults()
            all_arguments = dict(bound_args.arguments)

            actor_context = (
                all_arguments.get("actor_context")
                or all_arguments.get("auth_context")
                or {}
            )

            user_id = actor_context.get("user_id", "UNKNOWN_USER")
            user_email = actor_context.get("user_email", "unknown@terminal.psa")
            user_role = actor_context.get("user_role", "UNKNOWN_ROLE")
            client_ip = actor_context.get("client_ip", "127.0.0.1")

            # Extract clean tool parameters (omitting actor_context for logging)
            clean_params = {
                k: v for k, v in all_arguments.items()
                if k not in ("actor_context", "auth_context")
            }

            # 1. RBAC Permission Check
            if not is_role_permitted(user_role, tool_name):
                execution_time_ms = round((time.perf_counter() - start_time) * 1000, 3)
                
                # Write UNAUTHORIZED audit log
                audit_entry = AuditLogEntry(
                    user_id=user_id,
                    user_email=user_email,
                    user_role=user_role,
                    server_name=server_name,
                    tool_name=tool_name,
                    parameters=clean_params,
                    execution_time_ms=execution_time_ms,
                    status="UNAUTHORIZED",
                    client_ip=client_ip,
                )
                write_audit_log(audit_entry)

                return {
                    "error": f"PERMISSION_DENIED: Role '{user_role}' is not authorized to execute tool '{tool_name}'.",
                    "tool_name": tool_name,
                    "user_role": user_role,
                    "status": "UNAUTHORIZED",
                }

            # 2. Execute Business Logic
            result = func(*args, **kwargs)

            # 3. Measure Execution Latency
            execution_time_ms = round((time.perf_counter() - start_time) * 1000, 3)

            # 4. Write SUCCESS Audit Log
            audit_entry = AuditLogEntry(
                user_id=user_id,
                user_email=user_email,
                user_role=user_role,
                server_name=server_name,
                tool_name=tool_name,
                parameters=clean_params,
                execution_time_ms=execution_time_ms,
                status="SUCCESS",
                client_ip=client_ip,
            )
            write_audit_log(audit_entry)

            return result

        return wrapper
    return decorator
