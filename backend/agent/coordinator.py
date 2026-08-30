"""
Coordinator — routes each incident to the investigator that owns its domain,
using Send() for dynamic fan-out (per LangGraph's orchestrator-worker
pattern). No LLM call; this is the whole routing decision.

Routing is a property of the *problem*, not of the cluster id. Stage 1 now
produces an open set of incidents (however many distinct problems the alert
stream contains), so each one arrives already carrying the `domain` its
dominant problem type maps to — see clustering/problem_types.py. The
AGENT_TO_INVESTIGATOR_NODE map below only exists for clusters read from the
old hand-seeded `incident_clusters` table, which carries an agent name and no
problem type.
"""

from typing import Any

from langgraph.types import Send

from agent.state import OverallState

# Fallback only: agent name -> investigator node, for legacy table rows.
AGENT_TO_INVESTIGATOR_NODE = {
    "Agent_1_LaneInvestigator": "lane_investigator",
    "Agent_2_BCSSInvestigator": "power_investigator",
    "Agent_3_FleetPowerInvestigator": "fleet_power_investigator",
    "Agent_4_GeneralInvestigator": "general_investigator",
}

# An incident that matches no specialist domain still has to be investigated —
# it goes to the generalist rather than being silently dropped or forced into
# the lane investigator's domain, which is what the old default did.
DEFAULT_INVESTIGATOR_NODE = "general_investigator"


def resolve_domain(cluster: dict[str, Any]) -> str:
    """Prefer the domain Stage 1 derived; fall back to the agent-name map."""
    domain = cluster.get("domain")
    if domain:
        return domain
    return AGENT_TO_INVESTIGATOR_NODE.get(cluster.get("assigned_agent"), DEFAULT_INVESTIGATOR_NODE)


def assign_investigators(state: OverallState) -> list[Send]:
    """Conditional-edge function: fans one Send() out per cluster."""
    sends = []
    for cluster_id, cluster in state["clusters"].items():
        sends.append(
            Send(
                "investigator",
                {
                    "cluster_id": cluster_id,
                    "cluster_name": cluster["cluster_name"],
                    "target_entity": cluster["target_entity"],
                    "matched_alerts": cluster.get("matched_alerts", []),
                    "domain": resolve_domain(cluster),
                    # Open clustering means an investigator can't assume it
                    # already knows the scenario, so it is handed the problem
                    # type and the concrete assets involved.
                    "problem_type": cluster.get("problem_type"),
                    "problem_type_label": cluster.get("problem_type_label"),
                    "target_assets": cluster.get("target_assets", []),
                    "is_singleton": cluster.get("is_singleton", False),
                    "priority_score": cluster.get("priority_score"),
                },
            )
        )
    return sends
