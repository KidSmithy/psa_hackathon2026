"""
Converts a finished investigator finding (Python, snake_case, shaped for
mcp-docket-service) into the frontend's DocketItem TypeScript shape
(camelCase — see frontend/src/types/index.ts).

This is the one place that knows both shapes, so neither the investigator
code nor the frontend components need to know about the other's format.
"""

from typing import Any

# Evidence items don't carry their own timestamp from the LLM (the underlying
# tables the tools read from don't timestamp individual readings) — using the
# time this investigation actually ran is honest; inventing a per-reading
# timestamp would not be.
def to_docket_item(finding: dict[str, Any], run_timestamp: str) -> dict[str, Any]:
    return {
        "id": f"DOCKET-{finding['incident_id']}",
        "clusterId": finding["incident_id"],
        "title": finding["title"],
        "severity": finding["severity"],
        "impact": finding["impact"],
        "rootCause": finding["root_cause"],
        "dispatchStatus": "PENDING",
        "physicalEvidence": [
            {"text": text, "timestamp": run_timestamp, "verified": True}
            for text in finding.get("evidence_items", [])
        ],
        "plcRegisters": [
            {
                "code": reg["code"],
                "name": reg["name"],
                "status": reg["status"],
                "description": reg["description"],
                "category": reg["category"],
            }
            for reg in finding.get("plc_registers", [])
        ],
        "recommendedActions": finding.get("recommended_actions", []),
        "linkedTo": finding.get("linked_to", []),
    }
