"""
Correlation agent — the synthesis node.

Reads every finished investigator finding together and checks whether any
of them are cause and effect of one another (e.g. a BCSS-02 thermal trip
in Cluster B feeding a fleet SoC starvation in Cluster C), rather than
independent incidents. This is an LLM step, not a plain merge — spotting a
shared cause across findings needs reasoning a deterministic join can't do.

This node's output is consumed by docket.py's attach_linked_to(), which
merges each group into a `linked_to` field on the relevant findings before
submit_incident_docket is called.
"""

import os
from typing import Any

from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from agent.state import OverallState

MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-5.6-terra")

SYSTEM_PROMPT = """You are the Correlation agent in a port terminal incident triage system.

You receive the finished, independent findings from several investigator agents, each
already diagnosed separately. Your only job is to check whether any of these findings are
actually cause and effect of the same underlying failure — for example, a charging station
electrical fault that then causes a battery starvation elsewhere — rather than two
unrelated incidents that merely happened around the same time.

Only group findings together if there is a concrete shared entity or stated causal link in
the evidence (a shared asset id, a shared location, or one finding's evidence explaining
the other's trigger). When in doubt, leave findings standalone — a false merge is worse
than missing one.

You are comparing findings ACROSS different incidents. Findings from several specialists on
the SAME incident have already been reconciled by the aggregator, so every entry you see is
one incident.

Respond with JSON in exactly this shape, and nothing else:

{
  "linked_groups": [
    {
      "incident_ids": ["two or more incident ids that share an underlying cause"],
      "reason": "the concrete shared cause or entity linking them"
    }
  ]
}"""


class CorrelatedGroup(BaseModel):
    incident_ids: list[str] = Field(description="incident_id values that are linked together")
    reason: str = Field(description="The concrete shared cause or entity linking them")


class CorrelationResult(BaseModel):
    linked_groups: list[CorrelatedGroup] = Field(
        default_factory=list, description="Groups of 2+ incident_ids that are linked. Empty if none are."
    )


async def correlation_node(state: OverallState) -> dict[str, Any]:
    # Aggregated, not raw: one entry per incident, after multi-agent findings
    # have been reconciled. Falls back to raw findings if the aggregator
    # produced nothing, so the node still works if it is ever skipped.
    findings = state.get("aggregated_findings") or state.get("investigator_findings") or []

    if len(findings) < 2:
        return {"correlation": CorrelationResult(linked_groups=[]).model_dump()}

    model = ChatOpenAI(model=MODEL_NAME, temperature=0, reasoning_effort="none")
    structurer = model.with_structured_output(CorrelationResult, method="function_calling")

    findings_summary = "\n\n".join(
        f"incident_id: {f['incident_id']}\n"
        f"cluster_name: {f['cluster_name']}\n"
        f"root_cause: {f['root_cause']}\n"
        f"evidence: {f['evidence']}"
        for f in findings
    )

    result = await structurer.ainvoke(
        f"{SYSTEM_PROMPT}\n\nDo not use any emojis in reasons.\n\nFindings to review:\n\n{findings_summary}"
    )
    from agent.docket_shape import strip_emojis
    return {"correlation": strip_emojis(result.model_dump())}
