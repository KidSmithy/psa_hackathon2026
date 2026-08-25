"""
mcp-docket-service Server

Receives final synthesized findings from investigator agents and commits them to the Human Review Docket queue,
protected by enterprise RBAC and audit logging.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from fastmcp import FastMCP
from security import secure_audit_tool

SERVER_NAME = "mcp-docket-service"

# Initialize FastMCP Server
mcp = FastMCP(
    name=SERVER_NAME,
)

# Storage for committed review dockets
DOCKET_STORE: Dict[str, Dict[str, Any]] = {}


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
