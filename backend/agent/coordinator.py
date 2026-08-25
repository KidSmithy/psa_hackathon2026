"""
Coordinator — the orchestrator node.

Today this just routes each incident cluster to the investigator that owns
its domain, using Send() for dynamic fan-out (per LangGraph's
orchestrator-worker pattern). It does not call an LLM.

Future home for topology-aware severity assessment (calling the
diagnostics server's get_asset_impact tool to weigh upstream/downstream
impact before routing) — not built yet, kept out until it's needed.
"""

from typing import Any

from langgraph.types import Send

from agent.state import OverallState

# Which investigator node owns which cluster, keyed by the real
# `assigned_agent` value from the incident_clusters table — this is the
# actual routing decision already made by whoever seeded the database, not
# something guessed here. Confirmed against all 4 seeded rows:
#   CLUSTER-A -> Agent_1_LaneInvestigator   -> lane_investigator
#   CLUSTER-B -> Agent_2_BCSSInvestigator   -> power_investigator
#   CLUSTER-C -> Agent_3_FleetPowerInvestigator -> fleet_power_investigator
#   CLUSTER-D -> Agent_1_LaneInvestigator   -> lane_investigator (same agent as A —
#       a LiDAR-degraded safety stop on a lane is still this investigator's domain)
AGENT_TO_INVESTIGATOR_NODE = {
    "Agent_1_LaneInvestigator": "lane_investigator",
    "Agent_2_BCSSInvestigator": "power_investigator",
    "Agent_3_FleetPowerInvestigator": "fleet_power_investigator",
}


def coordinator(state: OverallState) -> dict[str, Any]:
    """Pass-through today. Kept as its own node so impact assessment has a home later."""
    return {}


def assign_investigators(state: OverallState) -> list[Send]:
    """Conditional-edge function: fans one Send() out per cluster."""
    sends = []
    for cluster_id, cluster in state["clusters"].items():
        node_name = AGENT_TO_INVESTIGATOR_NODE.get(cluster["assigned_agent"])
        if node_name is None:
            continue  # unrecognized assigned_agent value — skip rather than crash
        sends.append(
            Send(
                node_name,
                {
                    "cluster_id": cluster_id,
                    "cluster_name": cluster["cluster_name"],
                    "target_entity": cluster["target_entity"],
                    "matched_alerts": cluster.get("matched_alerts", []),
                },
            )
        )
    return sends
