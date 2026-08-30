"""
Registry of every investigator the orchestrator is allowed to assign.

One source of truth: the graph builds its nodes from this, the orchestrator
prompt lists its capabilities from this, and the fallback routing map validates
against this. Adding an investigator means adding a module and one entry here —
nothing else has to be kept in sync by hand.
"""

from dataclasses import dataclass
from types import ModuleType

from . import fleet_power, general, lane, power


@dataclass(frozen=True)
class InvestigatorSpec:
    domain: str        # graph node name, and what the orchestrator returns
    agent_name: str    # public label, e.g. shown on UI badges
    summary: str       # what it is for — this is what the orchestrator reads
    module: ModuleType  # supplies SYSTEM_PROMPT and TOOL_NAMES


INVESTIGATORS: tuple[InvestigatorSpec, ...] = (
    InvestigatorSpec(
        domain="lane_investigator",
        agent_name="Agent_1_LaneInvestigator",
        summary=(
            "Anything that stops a vehicle on a transfer lane: stalled AGVs, queue "
            "blockages, twistlock/hydraulic actuator faults, and safety-scanner (LiDAR) "
            "trips. Reads lane queue order, AGV telemetry, PLC fault codes and "
            "maintenance history."
        ),
        module=lane,
    ),
    InvestigatorSpec(
        domain="power_investigator",
        agent_name="Agent_2_BCSSInvestigator",
        summary=(
            "Electrical and thermal faults at a battery charging/swapping station: "
            "breaker trips, busbar overtemperature, voltage loss, coolant failure. "
            "Reads charger status, PLC fault codes and station maintenance history."
        ),
        module=power,
    ),
    InvestigatorSpec(
        domain="fleet_power_investigator",
        agent_name="Agent_3_FleetPowerInvestigator",
        summary=(
            "Fleet-wide battery health: state-of-charge starvation across a sector and "
            "charger-reassignment deadlocks. Reads AGV battery telemetry and asset "
            "impact topology. Use when the problem is fleet availability rather than "
            "one station's hardware."
        ),
        module=fleet_power,
    ),
    InvestigatorSpec(
        domain="general_investigator",
        agent_name="Agent_4_GeneralInvestigator",
        summary=(
            "Catch-all for incidents no specialist owns: comms/localisation dropouts, "
            "environmental advisories, and anomalies whose fault type could not be "
            "classified. Has the union of the read-only diagnostic tools and no domain "
            "assumption. Use when nothing else fits, not as a default."
        ),
        module=general,
    ),
)

BY_DOMAIN: dict[str, InvestigatorSpec] = {spec.domain: spec for spec in INVESTIGATORS}
DOMAIN_NAMES: tuple[str, ...] = tuple(spec.domain for spec in INVESTIGATORS)

# An incident that matches no specialist still has to be investigated.
DEFAULT_DOMAIN = "general_investigator"


def agent_name_for(domain: str) -> str:
    spec = BY_DOMAIN.get(domain)
    return spec.agent_name if spec else BY_DOMAIN[DEFAULT_DOMAIN].agent_name


def catalogue_text() -> str:
    """The investigator menu, rendered for the orchestrator's system prompt."""
    return "\n".join(
        f'- "{spec.domain}" ({spec.agent_name}): {spec.summary}' for spec in INVESTIGATORS
    )


__all__ = [
    "INVESTIGATORS",
    "BY_DOMAIN",
    "DOMAIN_NAMES",
    "DEFAULT_DOMAIN",
    "InvestigatorSpec",
    "agent_name_for",
    "catalogue_text",
    "fleet_power",
    "general",
    "lane",
    "power",
]
