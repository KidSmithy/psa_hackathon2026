"""
Shared mechanism every domain investigator worker uses. A domain file (e.g.
lane.py) only supplies a system prompt and a tool-name subset — this file is
what actually runs the two-stage investigation:

  1. A ReAct loop (LLM + domain-scoped MCP tools only) gathers evidence.
  2. A structuring call turns the transcript into a finding shaped for two
     different consumers at once: mcp-docket-service's submit_incident_docket
     (incident_id, cluster_name, root_cause, evidence, recommended_action —
     the 5 required fields), and the frontend's DocketItem type (title,
     severity, impact, plcRegisters, etc.) — see docket_shape.py for the
     conversion into DocketItem's exact camelCase shape.

Splitting evidence-gathering from structuring keeps each call simple: the
ReAct step is free to reason and call tools in any order, and the
structuring step's only job is producing valid JSON from what it already
found — it never has to decide which tool to call.
"""

import os
from typing import Any, Callable, Literal

from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from pydantic import BaseModel, Field

MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-5.6-terra")

SeverityLevel = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO", "NOMINAL"]


class PlcRegister(BaseModel):
    """Mirrors a decode_plc_fault_code result, when one was actually looked up."""

    code: str = Field(description="Hexadecimal register, e.g. '0x7E1'")
    name: str = Field(description="The fault_code string, e.g. 'ERR_TWISTLOCK_TIMEOUT'")
    description: str
    category: str = Field(description="The device_type, e.g. 'AGV_ACTUATOR'")
    status: str = Field(description="e.g. 'ACTIVE_FAULT' or 'NOMINAL'")


class InvestigatorFinding(BaseModel):
    incident_id: str = Field(description="The cluster id this finding belongs to, e.g. 'CLUSTER-A'")
    cluster_name: str
    root_cause: str = Field(description="The verified root cause, in one or two sentences")
    evidence: dict[str, Any] = Field(
        description="Key sensor readings and diagnostic values that support the root cause"
    )

    title: str = Field(description="Short incident title for a dashboard card, e.g. 'TRANSFER LANE 7 BOTTLENECK'")
    severity: SeverityLevel = Field(description="Overall severity judged from the evidence gathered")
    impact: str = Field(description="One-sentence downstream operational impact")
    evidence_items: list[str] = Field(
        description="2-5 short, concrete evidence statements a supervisor could read as a checklist, "
        "each citing an actual number or state you found (e.g. 'Hydraulic pressure peaked at 275 bar')"
    )
    plc_registers: list[PlcRegister] = Field(
        default_factory=list,
        description="One entry per PLC fault code actually decoded during the investigation. Empty if none.",
    )
    recommended_actions: list[str] = Field(
        description="1-3 concrete actions a terminal operator should take, most important first"
    )


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

        finding: InvestigatorFinding = await structurer.ainvoke(
            "Based on this investigation transcript, produce the final structured finding.\n"
            f"incident_id must be exactly '{state['cluster_id']}'.\n"
            f"cluster_name must be exactly '{state['cluster_name']}'.\n\n"
            f"Transcript:\n{transcript}"
        )

        finding_dict = finding.model_dump()
        # recommended_action (singular) is the field submit_incident_docket actually
        # requires — derived here rather than asked from the LLM twice in two shapes.
        finding_dict["recommended_action"] = "; ".join(finding.recommended_actions)
        return {"investigator_findings": [finding_dict]}

    node.__name__ = node_name
    return node
