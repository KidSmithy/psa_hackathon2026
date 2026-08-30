"""
Builds and compiles the orchestrator-worker graph:

    START -> (fan out, by domain) -> investigator -> correlation -> submit_docket -> END

"investigator" is one graph node; internally it dispatches to whichever of
the 4 domain agents (lane/power/fleet_power/general) the incident's domain
calls for. There used to be a "coordinator" node between START and the
fan-out, but it only ever returned {} — the actual routing decision has
always lived in assign_investigators() (see coordinator.py). Removed rather
than kept as a placeholder: add it back only when there is a real decision
for it to make.
"""

from langgraph.graph import END, START, StateGraph

from agent.coordinator import assign_investigators
from agent.correlation import correlation_node
from agent.docket import make_docket_node
from agent.investigators import fleet_power, general, lane, power
from agent.investigators.base import make_investigator_node
from agent.mcp_tools import bind_actor_context, build_mcp_client, filter_tools
from agent.state import OverallState


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

    lane_node = make_investigator_node("lane_investigator", lane.SYSTEM_PROMPT, lane_tools)
    power_node = make_investigator_node("power_investigator", power.SYSTEM_PROMPT, power_tools)
    fleet_power_node = make_investigator_node(
        "fleet_power_investigator", fleet_power.SYSTEM_PROMPT, fleet_power_tools
    )
    general_node = make_investigator_node(
        "general_investigator", general.SYSTEM_PROMPT, general_tools
    )

    domain_nodes = {
        "lane_investigator": lane_node,
        "power_investigator": power_node,
        "fleet_power_investigator": fleet_power_node,
        "general_investigator": general_node,
    }

    async def investigator_dispatcher(state: dict) -> dict:
        domain = state.get("domain", "general_investigator")
        node_fn = domain_nodes.get(domain, general_node)
        return await node_fn(state)

    builder = StateGraph(OverallState)

    builder.add_node("investigator", investigator_dispatcher)
    builder.add_node("correlation", correlation_node)
    builder.add_node("submit_docket", make_docket_node(docket_tool))

    builder.add_conditional_edges(START, assign_investigators, ["investigator"])
    builder.add_edge("investigator", "correlation")
    builder.add_edge("correlation", "submit_docket")
    builder.add_edge("submit_docket", END)

    return builder.compile(), client
