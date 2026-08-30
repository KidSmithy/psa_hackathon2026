"""
Docket submission — the final action step.

Deterministic: takes the investigator findings already sitting in state,
attaches the correlation agent's linked-incident groups to each one, and
hands the result to mcp-docket-service's submit_incident_docket tool. No LLM
call here — the reasoning already happened in the investigators and the
correlation agent, this step just delivers the result.
"""

from typing import Any, Callable

from agent.state import OverallState


def attach_linked_to(
    findings: list[dict[str, Any]], correlation: dict[str, Any] | None
) -> list[dict[str, Any]]:
    """
    Adds a `linked_to` list to each finding: the other incident_ids the
    correlation agent grouped it with, or an empty list if none. This is an
    extra key on top of submit_incident_docket's 5 required fields — the
    tool doesn't reject unknown keys, so this doesn't need a schema change
    on the docket service itself.
    """
    linked_groups = (correlation or {}).get("linked_groups", [])
    linked_map: dict[str, list[str]] = {}
    for group in linked_groups:
        ids = group.get("incident_ids", [])
        for incident_id in ids:
            linked_map[incident_id] = [other for other in ids if other != incident_id]

    return [
        {**finding, "linked_to": linked_map.get(finding["incident_id"], [])}
        for finding in findings
    ]


def make_docket_node(docket_tool) -> Callable[[OverallState], Any]:
    """Takes the already-fetched submit_incident_docket tool, returns a graph node."""

    async def submit_docket(state: OverallState) -> dict[str, Any]:
        # One entry per incident, post-aggregation — submit_incident_docket
        # would otherwise receive duplicate incident_ids when the orchestrator
        # assigned several specialists to one incident.
        findings = attach_linked_to(
            state.get("aggregated_findings") or state.get("investigator_findings") or [],
            state.get("correlation"),
        )
        result = await docket_tool.ainvoke({"incidents": findings})
        return {"docket_result": result}

    submit_docket.__name__ = "submit_docket"
    return submit_docket
