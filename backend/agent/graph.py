"""
Builds and compiles the orchestrator-worker graph:

    START -> coordinator -> (fan out) -> [lane_investigator | power_investigator]
                                              \\            /
                                               -> correlation -> submit_docket -> END

Only Lane and Power investigators are registered today — Fleet Energy and
Safety Sensor exist in investigators/ as ready-to-wire stubs (see
coordinator.py and each file's own STATUS note), added once Stage 1 can
actually produce Cluster_C / Cluster_D.
"""

from langgraph.graph import END, START, StateGraph

from agent.coordinator import assign_investigators, coordinator
from agent.correlation import correlation_node
from agent.docket import make_docket_node
from agent.investigators import lane, power
from agent.investigators.base import make_investigator_node
from agent.mcp_tools import build_mcp_client, get_tools_by_name
from agent.state import OverallState

INVESTIGATOR_NODE_NAMES = ["lane_investigator", "power_investigator"]


async def build_graph():
    """
    Async because fetching MCP tools requires connecting to the stdio
    servers first. Returns the compiled graph and the underlying
    MultiServerMCPClient (caller is responsible for its lifecycle).
    """
    client = build_mcp_client()

    lane_tools = await get_tools_by_name(client, lane.TOOL_NAMES)
    power_tools = await get_tools_by_name(client, power.TOOL_NAMES)
    docket_tools = await get_tools_by_name(client, {"submit_incident_docket"})
    docket_tool = docket_tools[0]

    builder = StateGraph(OverallState)

    builder.add_node("coordinator", coordinator)
    builder.add_node(
        "lane_investigator", make_investigator_node("lane_investigator", lane.SYSTEM_PROMPT, lane_tools)
    )
    builder.add_node(
        "power_investigator", make_investigator_node("power_investigator", power.SYSTEM_PROMPT, power_tools)
    )
    builder.add_node("correlation", correlation_node)
    builder.add_node("submit_docket", make_docket_node(docket_tool))

    builder.add_edge(START, "coordinator")
    builder.add_conditional_edges("coordinator", assign_investigators, INVESTIGATOR_NODE_NAMES)
    for node_name in INVESTIGATOR_NODE_NAMES:
        builder.add_edge(node_name, "correlation")
    builder.add_edge("correlation", "submit_docket")
    builder.add_edge("submit_docket", END)

    return builder.compile(), client
