"""
Orchestrator — decides which investigator(s) each incident goes to.

This replaces the deterministic `problem_type -> one agent` lookup. It is an
LLM step because the decision it makes is genuinely a judgement: an incident can
need two specialists at once (a charger trip that is also starving the fleet), a
single alert may not justify a full investigation at all, and the video analyst's
observation can contradict what the alert types suggest.

What it is given, per incident:
  * the alert TYPES (sensor fault codes), locations, assets and severities
  * Stage 1's clustering output — problem type, priority score, reason codes
  * the video analyst's finding, when there is footage

What it is deliberately NOT given: `raw_alerts.message`. Those messages are
human-written summaries that state the diagnosis outright ("Twistlock release
actuator timed out", "Pressure reached 275 bar limit"). Feeding them in would
mean the orchestrator and every investigator downstream are reading the answer
rather than deriving it, and the whole pipeline would look far more capable than
it is. See agent/facts.py for the projection that enforces this.

Output is JSON — one assignment list per incident, validated against the
investigator registry before it reaches the graph.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Optional

from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from agent.facts import incident_facts
from agent.investigators import BY_DOMAIN, DEFAULT_DOMAIN, DOMAIN_NAMES, catalogue_text

logger = logging.getLogger("psa_agent.orchestrator")

MODEL_NAME = os.getenv("ORCHESTRATOR_MODEL", os.getenv("OPENAI_MODEL", "gpt-5.6-terra"))
MAX_CONCURRENT = int(os.getenv("ORCHESTRATOR_MAX_CONCURRENCY", "8"))

# Stated in the prompt so the contract is legible; enforced by structured output
# so a chatty model still parses.
ASSIGNMENT_CONTRACT = """{
  "assignments": [
    {
      "domain": "one of the investigator ids listed above",
      "reason": "why this specialist, in one sentence, citing a fact you were given",
      "focus": "the specific question you want this investigator to answer",
      "confidence": 0.0-1.0
    }
  ],
  "rationale": "one or two sentences on why this set of investigators, and why not others",
  "video_influenced": true | false
}"""


class Assignment(BaseModel):
    domain: str = Field(description="Investigator id, exactly as listed in the catalogue")
    reason: str = Field(description="Why this specialist, citing a fact from the incident")
    focus: str = Field(description="The specific question this investigator should answer")
    confidence: float = Field(default=0.7, description="0.0-1.0")


class OrchestratorDecision(BaseModel):
    assignments: list[Assignment] = Field(
        description="One entry per investigator to run. Usually 1, at most 3."
    )
    rationale: str = Field(description="Why this set, and why not others")
    video_influenced: bool = Field(
        default=False, description="True if the video finding changed the decision"
    )


SYSTEM_PROMPT = f"""You are the Orchestrator in an automated container terminal's incident
triage system. Stage 1 has already grouped raw sensor alerts into incidents. Your only job
is to decide which specialist investigator agents should work each incident.

Available investigators:

{catalogue_text()}

How to decide:

1. Assign the investigator whose domain owns the most likely CAUSE, not the most visible
   symptom. A lane full of stopped vehicles caused by a charger outage is a power problem,
   not a traffic problem.
2. Assign more than one investigator only when the incident genuinely spans domains and
   each one would gather different evidence. Two investigators that would call the same
   tools and reach the same conclusion is waste, not thoroughness. Three is the maximum.

   Note that "stage1_problem_type" describes the KIND OF ALERT, not the full scope of the
   incident: clustering groups alerts of one type, so the field is always single-valued
   even when the incident is not. Look at "assets_involved" and
   "stage1_priority_reasons" to see whether a second domain is implicated. Patterns that
   genuinely need two specialists:
     - a charging-station fault whose assets include a vehicle, with "low_battery_risk"
       present: power_investigator for the station hardware, fleet_power_investigator for
       the stranded vehicle
     - a lane or traffic incident whose assets include a vehicle with "low_battery_risk":
       lane_investigator for the blockage, fleet_power_investigator for whether the
       vehicle simply ran flat
     - an incident located on a lane whose assets include a charger or station:
       lane_investigator for the operational impact, power_investigator for the electrical
       cause
     - "comms_ambiguous" on an incident with an otherwise clear domain: the specialist for
       the domain, plus general_investigator for the connectivity loss
   If none of those hold and the assets sit entirely inside one domain, assign one.
3. Prefer the specialist over "general_investigator". Use the generalist when no specialist
   domain fits, not as a hedge.
4. A single-alert incident usually warrants exactly one investigator, and sometimes the
   honest assignment is the generalist to confirm there is nothing to find.
5. When video findings are present, weigh them against the telemetry. If the footage shows
   something the alert types do not explain — an obstruction, a person in the lane, a
   dropped container — that changes which specialist should look. If a clip is
   UNUSABLE_FOOTAGE or NORMAL_ACTIVITY, ignore it and decide on telemetry alone. Set
   "video_influenced" honestly: only true if the footage actually changed your choice.
6. There may be more than one clip, because different alerts in the incident came from
   different cameras. Each carries "source_alert_ids" saying which alerts it covers. Two
   clips disagreeing is signal, not noise — it can mean the incident actually spans two
   separate problems, which is a reason to assign two specialists.

You are given alert TYPES and sensor state, not human incident summaries. Do not invent a
diagnosis: your output is a routing decision plus the question each investigator should
answer, never a root cause. The investigators have the tools to find that out; you do not.

Respond with JSON in exactly this shape, and nothing else:

{ASSIGNMENT_CONTRACT}"""


def _fallback(cluster: dict[str, Any], why: str) -> list[dict[str, Any]]:
    """
    Deterministic routing, used when the orchestrator is unavailable or returns
    nothing usable. Keeps the pipeline running instead of dropping an incident.
    """
    domain = cluster.get("domain") or DEFAULT_DOMAIN
    if domain not in BY_DOMAIN:
        domain = DEFAULT_DOMAIN
    return [
        {
            "domain": domain,
            "reason": f"Deterministic fallback ({why}); routed on Stage 1 problem type.",
            "focus": "Establish the root cause from telemetry and diagnostics.",
            "confidence": 0.3,
            "source": "fallback",
        }
    ]


def _validate(decision: OrchestratorDecision, cluster: dict[str, Any]) -> list[dict[str, Any]]:
    """Drops unknown domains and de-duplicates; falls back if nothing survives."""
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for assignment in decision.assignments:
        domain = assignment.domain.strip()
        if domain not in BY_DOMAIN:
            logger.warning("Orchestrator returned unknown domain %r; dropping", domain)
            continue
        if domain in seen:
            continue
        seen.add(domain)
        out.append(
            {
                "domain": domain,
                "reason": assignment.reason,
                "focus": assignment.focus,
                "confidence": assignment.confidence,
                "source": "orchestrator",
            }
        )
    if not out:
        return _fallback(cluster, "no valid domain in response")
    return out[:3]


async def decide_for_incident(
    incident_id: str,
    cluster: dict[str, Any],
    video_findings: Optional[list[dict[str, Any]]],
    model: ChatOpenAI,
) -> tuple[list[dict[str, Any]], str]:
    """Returns (assignments, rationale) for one incident."""
    facts = incident_facts(incident_id, cluster)
    payload: dict[str, Any] = {"incident": facts}
    # A list: the CCTV link is alert-level, so an incident whose alerts point
    # at two cameras arrives with two independent readings, which may not agree.
    payload["video_analysis"] = video_findings or None

    structurer = model.with_structured_output(OrchestratorDecision, method="function_calling")
    try:
        decision: OrchestratorDecision = await structurer.ainvoke(
            f"{SYSTEM_PROMPT}\n\nIncident to route:\n\n{json.dumps(payload, indent=2)}"
        )
    except Exception:
        logger.warning("Orchestrator call failed for %s", incident_id, exc_info=True)
        return _fallback(cluster, "orchestrator call failed"), "Orchestrator unavailable."

    assignments = _validate(decision, cluster)
    logger.info(
        "Orchestrator %s -> %s%s",
        incident_id,
        [a["domain"] for a in assignments],
        " (video influenced)" if decision.video_influenced else "",
    )
    return assignments, decision.rationale


async def orchestrator_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    Graph node. Decides assignments for every incident in parallel and returns
    {"assignments": {...}, "orchestration": {...}}.
    """
    clusters: dict[str, dict[str, Any]] = state.get("clusters", {})
    video_findings: dict[str, list[dict[str, Any]]] = state.get("video_findings", {}) or {}
    if not clusters:
        return {"assignments": {}, "orchestration": {}}

    model = ChatOpenAI(model=MODEL_NAME, temperature=0, reasoning_effort="none")
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def run(incident_id: str, cluster: dict[str, Any]):
        async with semaphore:
            assignments, rationale = await decide_for_incident(
                incident_id, cluster, video_findings.get(incident_id), model
            )
            return incident_id, assignments, rationale

    results = await asyncio.gather(*(run(iid, c) for iid, c in clusters.items()))

    assignments = {iid: a for iid, a, _ in results}
    orchestration = {
        iid: {
            "rationale": rationale,
            "domains": [a["domain"] for a in assigned],
            "had_video": iid in video_findings,
        }
        for iid, assigned, rationale in results
    }
    total = sum(len(a) for a in assignments.values())
    multi = sum(1 for a in assignments.values() if len(a) > 1)
    logger.info(
        "Orchestrator assigned %d investigator run(s) across %d incident(s); %d multi-agent",
        total, len(assignments), multi,
    )
    return {"assignments": assignments, "orchestration": orchestration}


__all__ = [
    "ASSIGNMENT_CONTRACT",
    "SYSTEM_PROMPT",
    "OrchestratorDecision",
    "orchestrator_node",
    "decide_for_incident",
    "DOMAIN_NAMES",
]
