"""
Builds and compiles the orchestrator-worker graph:

    START -> (fan out, by domain) -> [lane_investigator | power_investigator |
                                       fleet_power_investigator | general_investigator]
                                              \\         |         |         /
                                               -> correlation -> submit_docket -> END

Each domain gets its own named graph node rather than one shared dispatcher
node. That costs a few extra add_node()/add_edge() calls when a new domain
is added, in exchange for every trace (Langfuse, LangSmith, or a rendered
graph diagram) showing which specialist actually ran on a given incident —
with one shared node, every incident's trace looks identical from the
outside no matter which agent handled it. assign_investigators() (see
coordinator.py) already resolves the correct node name per incident, so
Send() can target it directly.
"""

from langgraph.graph import END, START, StateGraph

from agent.coordinator import assign_investigators
from agent.correlation import correlation_node
from agent.docket import make_docket_node
from agent.investigators import fleet_power, general, lane, power
from agent.investigators.base import make_investigator_node
from agent.mcp_tools import bind_actor_context, build_mcp_client, filter_tools
from agent.state import OverallState

INVESTIGATOR_NODE_NAMES = [
    "lane_investigator",
    "power_investigator",
    "fleet_power_investigator",
    "general_investigator",
]


async def build_graph():
    """
    Async because fetching MCP tools requires connecting to the stdio
    server first. Returns the compiled graph and the underlying
    MultiServerMCPClient (caller is responsible for its lifecycle).
    """
    client = build_mcp_client()
    all_tools = await client.get_tools()

    # Roles picked from backend/mcp/security.py's RBAC_PERMISSIONS matrix:
    # LANE_OPERATIONS_ENGINEER is the smallest role that covers every read
    # tool used by all 4 investigators; SYSTEM_COORDINATOR is the only role
    # permitted to call submit_incident_docket.
    lane_tools = bind_actor_context(
        filter_tools(all_tools, lane.TOOL_NAMES), "LANE_OPERATIONS_ENGINEER"
    )
    power_tools = bind_actor_context(
        filter_tools(all_tools, power.TOOL_NAMES), "LANE_OPERATIONS_ENGINEER"
    )
    fleet_power_tools = bind_actor_context(
        filter_tools(all_tools, fleet_power.TOOL_NAMES), "LANE_OPERATIONS_ENGINEER"
    )
    general_tools = bind_actor_context(
        filter_tools(all_tools, general.TOOL_NAMES), "LANE_OPERATIONS_ENGINEER"
    )
    docket_tool = bind_actor_context(
        filter_tools(all_tools, {"submit_incident_docket"}), "SYSTEM_COORDINATOR"
    )[0]

    builder = StateGraph(OverallState)

    builder.add_node(
        "lane_investigator", make_investigator_node("lane_investigator", lane.SYSTEM_PROMPT, lane_tools)
    )
    builder.add_node(
        "power_investigator", make_investigator_node("power_investigator", power.SYSTEM_PROMPT, power_tools)
    )
    builder.add_node(
        "fleet_power_investigator",
        make_investigator_node("fleet_power_investigator", fleet_power.SYSTEM_PROMPT, fleet_power_tools),
    )
    builder.add_node(
        "general_investigator",
        make_investigator_node("general_investigator", general.SYSTEM_PROMPT, general_tools),
    )
    builder.add_node("correlation", correlation_node)
    builder.add_node("submit_docket", make_docket_node(docket_tool))

    builder.add_conditional_edges(START, assign_investigators, INVESTIGATOR_NODE_NAMES)
    for node_name in INVESTIGATOR_NODE_NAMES:
        builder.add_edge(node_name, "correlation")
    builder.add_edge("correlation", "submit_docket")
    builder.add_edge("submit_docket", END)

    return builder.compile(), client
