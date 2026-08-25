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

# Which investigator node owns which cluster. Cluster_C and Cluster_D route
# to investigators that exist as stubs today (see investigators/fleet_energy.py
# and investigators/safety_sensor.py) — Stage 1 doesn't produce those cluster
# ids yet either (backend/mcp/mock_data.py only defines Cluster_A/B), so this
# map is future-proofed but currently only A/B will ever actually fire.
CLUSTER_TO_INVESTIGATOR = {
    "Cluster_A": "lane_investigator",
    "Cluster_B": "power_investigator",
    "Cluster_C": "fleet_energy_investigator",
    "Cluster_D": "safety_sensor_investigator",
}


def coordinator(state: OverallState) -> dict[str, Any]:
    """Pass-through today. Kept as its own node so impact assessment has a home later."""
    return {}


def assign_investigators(state: OverallState) -> list[Send]:
    """Conditional-edge function: fans one Send() out per cluster."""
    sends = []
    for cluster_id, cluster in state["clusters"].items():
        node_name = CLUSTER_TO_INVESTIGATOR.get(cluster_id)
        if node_name is None:
            continue  # unknown cluster type — no investigator assigned, skip rather than crash
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
