"""
Builds and compiles the orchestrator-worker graph:

    START -> video_analysis -> orchestrator -> (fan out, by domain)
                                                 |
        [lane_investigator | power_investigator | fleet_power_investigator |
         general_investigator]
                                                 |
                              aggregator -> correlation -> submit_docket -> END

Two AI stages sit in front of the fan-out:

  video_analysis  Gemini reads the CCTV clip attached to an incident, when
                  there is one. Runs first so what the camera saw is an INPUT
                  to routing rather than something discovered afterwards.
  orchestrator    Decides which specialist(s) each incident needs, and may
                  assign more than one. This replaced a static
                  problem_type -> agent lookup.

And one after it:

  aggregator      Fans N findings per incident back in to exactly one, since
                  correlation, the docket and the frontend all assume one
                  finding per incident.

Each domain gets its own named graph node rather than one shared dispatcher
node, so every trace (Langfuse, LangSmith, or a rendered graph diagram) shows
which specialist actually ran on a given incident — with one shared node,
every incident's trace looks identical from the outside no matter which agent
handled it. The nodes are built by looping the investigator registry, so
adding a domain is one entry in agent/investigators/__init__.py rather than
an add_node()/add_edge() pair here.
"""

from langgraph.graph import END, START, StateGraph

from agent.aggregator import aggregator_node
from agent.coordinator import assign_investigators
from agent.correlation import correlation_node
from agent.docket import make_docket_node
from agent.investigators import INVESTIGATORS
from agent.investigators.base import make_investigator_node
from agent.mcp_tools import bind_actor_context, build_mcp_client, filter_tools
from agent.orchestrator import orchestrator_node
from agent.state import OverallState
from agent.video_analyst import video_analysis_node

INVESTIGATOR_NODE_NAMES = [spec.domain for spec in INVESTIGATORS]


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
    docket_tool = bind_actor_context(
        filter_tools(all_tools, {"submit_incident_docket"}), "SYSTEM_COORDINATOR"
    )[0]

    builder = StateGraph(OverallState)

    builder.add_node("video_analysis", video_analysis_node)
    builder.add_node("orchestrator", orchestrator_node)

    for spec in INVESTIGATORS:
        tools = bind_actor_context(
            filter_tools(all_tools, spec.module.TOOL_NAMES), "LANE_OPERATIONS_ENGINEER"
        )
        builder.add_node(
            spec.domain,
            make_investigator_node(spec.domain, spec.module.SYSTEM_PROMPT, tools),
        )

    builder.add_node("aggregator", aggregator_node)
    builder.add_node("correlation", correlation_node)
    builder.add_node("submit_docket", make_docket_node(docket_tool))

    builder.add_edge(START, "video_analysis")
    builder.add_edge("video_analysis", "orchestrator")
    builder.add_conditional_edges("orchestrator", assign_investigators, INVESTIGATOR_NODE_NAMES)
    for node_name in INVESTIGATOR_NODE_NAMES:
        builder.add_edge(node_name, "aggregator")
    builder.add_edge("aggregator", "correlation")
    builder.add_edge("correlation", "submit_docket")
    builder.add_edge("submit_docket", END)

    return builder.compile(), client
