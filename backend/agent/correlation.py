"""
Correlation agent — the synthesis node.

Reads every finished investigator finding together and checks whether any
of them are cause and effect of one another (e.g. a BCSS-02 thermal trip
in Cluster B feeding a fleet SoC starvation in Cluster C), rather than
independent incidents. This is an LLM step, not a plain merge — spotting a
shared cause across findings needs reasoning a deterministic join can't do.

NOTE: submit_incident_docket (backend/mcp/docket_server.py) only accepts a
flat list of independent incidents today. This node's `correlation` output
is not yet threaded into the docket payload in docket.py — that needs a
schema change on the docket service first (e.g. a `linked_to` field).
"""

import os
from typing import Any

from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from agent.state import OverallState

MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

SYSTEM_PROMPT = """You are the Correlation agent in a port terminal incident triage system.

You receive the finished, independent findings from several investigator agents, each
already diagnosed separately. Your only job is to check whether any of these findings are
actually cause and effect of the same underlying failure — for example, a charging station
electrical fault that then causes a battery starvation elsewhere — rather than two
unrelated incidents that merely happened around the same time.

Only group findings together if there is a concrete shared entity or stated causal link in
the evidence (a shared asset id, a shared location, or one finding's evidence explaining
the other's trigger). When in doubt, leave findings standalone — a false merge is worse
than missing one."""


class CorrelatedGroup(BaseModel):
    incident_ids: list[str] = Field(description="incident_id values that are linked together")
    reason: str = Field(description="The concrete shared cause or entity linking them")


class CorrelationResult(BaseModel):
    linked_groups: list[CorrelatedGroup] = Field(
        default_factory=list, description="Groups of 2+ incident_ids that are linked. Empty if none are."
    )


async def correlation_node(state: OverallState) -> dict[str, Any]:
    findings = state["investigator_findings"]

    if len(findings) < 2:
        return {"correlation": CorrelationResult(linked_groups=[]).model_dump()}

    model = ChatOpenAI(model=MODEL_NAME, temperature=0)
    structurer = model.with_structured_output(CorrelationResult)

    findings_summary = "\n\n".join(
        f"incident_id: {f['incident_id']}\n"
        f"cluster_name: {f['cluster_name']}\n"
        f"root_cause: {f['root_cause']}\n"
        f"evidence: {f['evidence']}"
        for f in findings
    )

    result = await structurer.ainvoke(
        f"{SYSTEM_PROMPT}\n\nFindings to review:\n\n{findings_summary}"
    )
    return {"correlation": result.model_dump()}
