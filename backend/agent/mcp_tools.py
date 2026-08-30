"""
Connects to the unified MCP server (backend/mcp/server.py) over stdio, and
hands back its tools as LangChain-compatible tool objects.

This is the only file that knows the MCP server's file path. Everything
else in backend/agent/ just asks for tools by name.
"""

import sys
from pathlib import Path

from langchain_mcp_adapters.client import MultiServerMCPClient

MCP_DIR = Path(__file__).resolve().parent.parent / "mcp"


def build_mcp_client() -> MultiServerMCPClient:
    """
    Launches the unified MCP server as a stdio subprocess using the *current*
    Python interpreter (sys.executable), so it runs inside the same virtual
    environment as the agent process.
    """
    return MultiServerMCPClient(
        {
            "psa_unified": {
                "command": sys.executable,
                "args": [str(MCP_DIR / "server.py")],
                "transport": "stdio",
            },
        }
    )


def filter_tools(all_tools: list, names: set[str]) -> list:
    """Filters a list of tools to `names`, raising if any are missing."""
    tools = [t for t in all_tools if t.name in names]
    missing = names - {t.name for t in tools}
    if missing:
        raise RuntimeError(
            f"Requested MCP tools not found on any connected server: {missing}. "
            f"Available tools: {sorted(t.name for t in all_tools)}"
        )
    return tools


async def get_tools_by_name(
    client: MultiServerMCPClient, names: set[str]
) -> list:
    """Fetches all tools across all servers, then filters to `names`."""
    all_tools = await client.get_tools()
    return filter_tools(all_tools, names)


def bind_actor_context(tools: list, user_role: str) -> list:
    """
    Every MCP tool now enforces RBAC via an `actor_context` argument (see
    backend/mcp/security.py) — without one, it defaults to "UNKNOWN_ROLE"
    and every call is denied. Rather than trust the LLM to remember to pass
    a correct actor_context on every single tool call, this wraps each
    tool's coroutine to inject a fixed one for the calling agent, so
    authorization is enforced by our own code, not by LLM tool-call
    compliance. Mutates and returns the same tool objects.
    """
    actor_context = {
        "user_id": "langgraph-agent",
        "user_email": "agent@psa-triage.local",
        "user_role": user_role,
        "client_ip": "127.0.0.1",
    }

    for tool in tools:
        original_coroutine = tool.coroutine

        async def call_with_actor_context(*args, __original=original_coroutine, **kwargs):
            kwargs["actor_context"] = actor_context
            return await __original(*args, **kwargs)

        tool.coroutine = call_with_actor_context

    return tools
