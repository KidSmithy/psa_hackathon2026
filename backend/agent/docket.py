"""
Docket submission — the final action step.

Deterministic: takes the investigator findings already sitting in state and
hands them to mcp-docket-service's submit_incident_docket tool. No LLM call
here — the reasoning already happened in the investigators and the
correlation agent, this step just delivers the result.
"""

from typing import Any, Callable

from agent.state import OverallState


def make_docket_node(docket_tool) -> Callable[[OverallState], Any]:
    """Takes the already-fetched submit_incident_docket tool, returns a graph node."""

    async def submit_docket(state: OverallState) -> dict[str, Any]:
        result = await docket_tool.ainvoke({"incidents": state["investigator_findings"]})
        return {"docket_result": result}

    submit_docket.__name__ = "submit_docket"
    return submit_docket
