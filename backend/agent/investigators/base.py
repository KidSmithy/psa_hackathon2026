"""
Shared mechanism every domain investigator worker uses. A domain file (e.g.
lane.py) only supplies a system prompt and a tool-name subset — this file is
what actually runs the two-stage investigation:

  1. A ReAct loop (LLM + domain-scoped MCP tools only) gathers evidence.
  2. A structuring call turns the transcript into the exact JSON shape
     mcp-docket-service's submit_incident_docket requires.

Splitting evidence-gathering from structuring keeps each call simple: the
ReAct step is free to reason and call tools in any order, and the
structuring step's only job is producing valid JSON from what it already
found — it never has to decide which tool to call.
"""

import os
from typing import Any, Callable

from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from pydantic import BaseModel, Field

MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


class InvestigatorFinding(BaseModel):
    """Matches the `incidents[]` item shape required by submit_incident_docket."""

    incident_id: str = Field(description="The cluster id this finding belongs to, e.g. 'Cluster_A'")
    cluster_name: str
    root_cause: str = Field(description="The verified root cause, in one or two sentences")
    evidence: dict[str, Any] = Field(
        description="Key sensor readings and diagnostic values that support the root cause"
    )
    recommended_action: str = Field(description="The concrete action a terminal operator should take")


def make_investigator_node(
    node_name: str, system_prompt: str, tools: list
) -> Callable[[dict[str, Any]], Any]:
    """
    Returns an async LangGraph node function bound to one domain's tools and
    system prompt. The returned function is what gets registered on the
    graph via `graph.add_node(node_name, make_investigator_node(...))`.
    """
    model = ChatOpenAI(model=MODEL_NAME, temperature=0)
    react_agent = create_react_agent(model, tools, prompt=system_prompt)
    structurer = model.with_structured_output(InvestigatorFinding)

    async def node(state: dict[str, Any]) -> dict[str, Any]:
        task = (
            f"Investigate {state['cluster_name']} (cluster id: {state['cluster_id']}).\n"
            f"Target entity: {state['target_entity']}.\n"
            f"Triggering alert ids: {state.get('matched_alerts', [])}.\n"
            "Use your tools to gather evidence, then explain the verified root cause "
            "in plain terms before you finish."
        )
        result = await react_agent.ainvoke({"messages": [{"role": "user", "content": task}]})
        transcript = "\n".join(
            f"{m.type}: {m.content}" for m in result["messages"] if getattr(m, "content", None)
        )

        finding = await structurer.ainvoke(
            "Based on this investigation transcript, produce the final structured finding.\n"
            f"incident_id must be exactly '{state['cluster_id']}'.\n"
            f"cluster_name must be exactly '{state['cluster_name']}'.\n\n"
            f"Transcript:\n{transcript}"
        )
        return {"investigator_findings": [finding.model_dump()]}

    node.__name__ = node_name
    return node
