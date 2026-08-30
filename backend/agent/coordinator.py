"""
Coordinator — fans the orchestrator's decision out into worker invocations.

The routing *decision* now lives in agent/orchestrator.py: an LLM step that can
assign several specialists to one incident and that weighs the video analyst's
finding before choosing. This module is the mechanical half — turn
`state["assignments"]` into one Send() per (incident, investigator) pair, so an
incident given two specialists produces two parallel investigations.

Send() targets the domain's node name directly (see graph.py for why each
domain is its own node rather than one shared dispatcher).

The deterministic problem-type map survives only as a fallback for an incident
the orchestrator produced nothing for — a dropped incident is worse than a
generically-routed one.
"""

from typing import Any

from langgraph.types import Send

from agent.investigators import BY_DOMAIN, DEFAULT_DOMAIN
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
DEFAULT_INVESTIGATOR_NODE = DEFAULT_DOMAIN


def resolve_domain(cluster: dict[str, Any]) -> str:
    """Deterministic routing: Stage 1's derived domain, else the agent-name map."""
    domain = cluster.get("domain")
    if domain in BY_DOMAIN:
        return domain
    return AGENT_TO_INVESTIGATOR_NODE.get(cluster.get("assigned_agent"), DEFAULT_INVESTIGATOR_NODE)


def assign_investigators(state: OverallState) -> list[Send]:
    """
    Conditional-edge function: one Send() per assignment, not per incident.
    An incident the orchestrator gave two specialists fans out twice, and the
    two runs differ in `focus` — which is the entire reason for assigning both.
    """
    assignments = state.get("assignments") or {}
    video_findings = state.get("video_findings") or {}
    sends: list[Send] = []

    for cluster_id, cluster in state["clusters"].items():
        planned = assignments.get(cluster_id) or [
            {
                "domain": resolve_domain(cluster),
                "focus": "",
                "reason": "No orchestrator assignment; routed deterministically.",
            }
        ]
        for assignment in planned:
            domain = assignment.get("domain")
            if domain not in BY_DOMAIN:
                domain = resolve_domain(cluster)
            sends.append(
                Send(
                    domain,
                    {
                        "cluster_id": cluster_id,
                        "cluster_name": cluster["cluster_name"],
                        "target_entity": cluster["target_entity"],
                        "matched_alerts": cluster.get("matched_alerts", []),
                        "domain": domain,
                        # From the orchestrator: why this specialist was picked
                        # and the specific question it should answer.
                        "focus": assignment.get("focus", ""),
                        "assignment_reason": assignment.get("reason", ""),
                        # Open clustering means an investigator can't assume it
                        # already knows the scenario, so it is handed the problem
                        # type and the concrete assets involved. Never includes
                        # raw_alerts.message — see agent/facts.py.
                        "problem_type": cluster.get("problem_type"),
                        "problem_type_label": cluster.get("problem_type_label"),
                        "target_assets": cluster.get("target_assets", []),
                        "is_singleton": cluster.get("is_singleton", False),
                        "priority_score": cluster.get("priority_score"),
                        # What the cameras saw, when this incident had footage.
                        "video_findings": video_findings.get(cluster_id),
                    },
                )
            )
    return sends
