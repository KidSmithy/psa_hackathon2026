"""
Converts a finished investigator finding (Python, snake_case, shaped for
mcp-docket-service) into the frontend's DocketItem TypeScript shape
(camelCase — see frontend/src/types/index.ts).

This is the one place that knows both shapes, so neither the investigator
code nor the frontend components need to know about the other's format.
"""

import re
from typing import Any

EMOJI_PATTERN = re.compile(
    "["
    "\U0001F1E0-\U0001F1FF"  # flags (iOS)
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F700-\U0001F77F"  # alchemical symbols
    "\U0001F780-\U0001F7FF"  # Geometric Shapes Extended
    "\U0001F800-\U0001F8FF"  # Supplemental Arrows-C
    "\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
    "\U0001FA00-\U0001FA6F"  # Chess Symbols
    "\U0001FA70-\U0001FAFF"  # Symbols and Pictographs Extended-A
    "\U00002702-\U000027B0"  # Dingbats
    "\U000024C2-\U0001F251"
    "\U00002600-\U000026FF"  # Miscellaneous Symbols
    "]+",
    flags=re.UNICODE,
)


def strip_emojis(val: Any) -> Any:
    if isinstance(val, str):
        return EMOJI_PATTERN.sub("", val).strip()
    if isinstance(val, list):
        return [strip_emojis(item) for item in val]
    if isinstance(val, dict):
        return {k: strip_emojis(v) for k, v in val.items()}
    return val


from typing import Any, Optional


# Evidence items don't carry their own timestamp from the LLM (the underlying
# tables the tools read from don't timestamp individual readings) — using the
# time this investigation actually ran is honest; inventing a per-reading
# timestamp would not be.
def to_docket_item(
    finding: dict[str, Any],
    run_timestamp: str,
    video_findings: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    finding = strip_emojis(finding)
    incident_id = finding.get("incident_id", "UNKNOWN")
    clips = video_findings if video_findings is not None else (finding.get("video_findings") or [])
    return {
        "id": f"DOCKET-{incident_id}",
        "clusterId": incident_id,
        "title": finding.get("title", ""),
        "severity": finding.get("severity", "LOW"),
        "impact": finding.get("impact", ""),
        "rootCause": finding.get("root_cause", ""),
        "dispatchStatus": "PENDING",
        "physicalEvidence": [
            {"text": text, "timestamp": run_timestamp, "verified": True}
            for text in finding.get("evidence_items", [])
        ],
        "plcRegisters": [
            {
                "code": reg.get("code", ""),
                "name": reg.get("name", ""),
                "status": reg.get("status", ""),
                "description": reg.get("description", ""),
                "category": reg.get("category", ""),
            }
            for reg in finding.get("plc_registers", [])
        ],
        "recommendedActions": finding.get("recommended_actions", []),
        "linkedTo": finding.get("linked_to", []),
        "videoEvidence": clips,
    }

