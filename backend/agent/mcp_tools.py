"""
Connects to the three existing MCP servers in backend/mcp/ over stdio, and
hands back their tools as LangChain-compatible tool objects.

This is the only file that knows the MCP servers' file paths. Everything
else in backend/agent/ just asks for tools by name.
"""

import sys
from pathlib import Path

from langchain_mcp_adapters.client import MultiServerMCPClient

MCP_DIR = Path(__file__).resolve().parent.parent / "mcp"


def build_mcp_client() -> MultiServerMCPClient:
    """
    Launches the three MCP servers as stdio subprocesses using the *current*
    Python interpreter (sys.executable), so they run inside the same virtual
    environment as the agent process — not whatever "python" resolves to on
    the system PATH.
    """
    return MultiServerMCPClient(
        {
            "telemetry": {
                "command": sys.executable,
                "args": [str(MCP_DIR / "telemetry_server.py")],
                "transport": "stdio",
            },
            "diagnostics": {
                "command": sys.executable,
                "args": [str(MCP_DIR / "diagnostics_server.py")],
                "transport": "stdio",
            },
            "docket": {
                "command": sys.executable,
                "args": [str(MCP_DIR / "docket_server.py")],
                "transport": "stdio",
            },
        }
    )


async def get_tools_by_name(
    client: MultiServerMCPClient, names: set[str]
) -> list:
    """Fetches all tools across all three servers, then filters to `names`."""
    all_tools = await client.get_tools()
    tools = [t for t in all_tools if t.name in names]

    missing = names - {t.name for t in tools}
    if missing:
        raise RuntimeError(
            f"Requested MCP tools not found on any connected server: {missing}. "
            f"Available tools: {sorted(t.name for t in all_tools)}"
        )
    return tools
