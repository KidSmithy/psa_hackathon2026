"""
Bridges into Stage 1's clustering logic, which lives in backend/mcp/mock_data.py.

backend/mcp/ is intentionally a flat, package-free folder (its own servers
import each other as `from mock_data import ...`, run via `python
telemetry_server.py`), so it isn't installable as a normal package. This
file is the one place that reaches across the folder boundary to reuse it,
rather than duplicating the cluster-matching logic here.
"""

import sys
from pathlib import Path
from typing import Any

MCP_DIR = Path(__file__).resolve().parent.parent / "mcp"
if str(MCP_DIR) not in sys.path:
    sys.path.insert(0, str(MCP_DIR))

from mock_data import get_stage1_clusters  # noqa: E402


def get_incident_clusters(raw_alert_ids: list[str]) -> dict[str, dict[str, Any]]:
    """Thin, named wrapper so agent code never imports across the folder boundary directly."""
    return get_stage1_clusters(raw_alert_ids)
