"""
Aggregator — collapses the findings from an incident's investigators into one.

Now that the orchestrator can assign several specialists to a single incident,
`investigator_findings` can hold two or three entries sharing an `incident_id`.
Everything downstream — correlation, the docket, the frontend's DocketItem —
assumes one finding per incident, and `DOCKET-{incident_id}` would collide
outright. This node is where the fan-in happens.

One finding for an incident is passed straight through: there is nothing to
merge, and paraphrasing it through another LLM call would only add cost and a
chance to lose a number. Two or more go through a merge call whose job is to
reconcile them — including saying so when the specialists disagree, rather than
silently picking one.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from collections import defaultdict
from typing import Any

from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

logger = logging.getLogger("psa_agent.aggregator")

MODEL_NAME = os.getenv("AGGREGATOR_MODEL", os.getenv("OPENAI_MODEL", "gpt-5.6-terra"))
MAX_CONCURRENT = int(os.getenv("AGGREGATOR_MAX_CONCURRENCY", "6"))

MERGED_CONTRACT = """{
  "root_cause": "the single most likely cause, reconciling all specialists",
  "title": "SHORT DASHBOARD TITLE",
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO" | "NOMINAL",
  "impact": "one sentence on downstream operational impact",
  "evidence_items": ["concrete statements citing real numbers found by the investigators"],
  "recommended_actions": ["most important first"],
  "contributing_domains": ["which investigators' evidence supports the conclusion"],
  "disagreements": ["where specialists conflicted, and which reading was preferred and why"],
  "confidence": 0.0-1.0
}"""


class MergedFinding(BaseModel):
    root_cause: str = Field(description="Single most likely cause, reconciling all specialists")
    title: str = Field(description="Short incident title for a dashboard card")
    severity: str = Field(description="CRITICAL | HIGH | MEDIUM | LOW | INFO | NOMINAL")
    impact: str = Field(description="One-sentence downstream operational impact")
    evidence_items: list[str] = Field(
        description="Concrete statements citing real values the investigators found"
    )
    recommended_actions: list[str] = Field(description="1-4 actions, most important first")
    contributing_domains: list[str] = Field(
        default_factory=list, description="Which investigators' evidence supports the conclusion"
    )
    disagreements: list[str] = Field(
        default_factory=list,
        description="Where specialists conflicted and which reading was preferred. Empty if they agreed.",
    )
    confidence: float = Field(default=0.7, description="0.0-1.0")


SYSTEM_PROMPT = f"""You are the Aggregator in an automated container terminal's incident
triage system. Several specialist investigators examined the SAME incident from different
angles. Each has already gathered its own evidence and reached its own conclusion. Your job
is to produce the one finding an operator will actually read.

Rules:

1. Reconcile, do not concatenate. Decide which specialist's account best explains the
   evidence as a whole, and state that as the root cause.
2. Preserve every concrete number. "Hydraulic pressure peaked at 275 bar" survives the
   merge; "pressure was high" is a regression. Never invent a value no investigator
   reported.
3. If the specialists disagree, say so in "disagreements" and explain which reading you
   preferred and why. A merged finding that hides a genuine conflict is worse than one that
   surfaces it — the operator needs to know the diagnosis is contested.
4. Set "confidence" to reflect how well the evidence actually supports the conclusion, not
   how many investigators ran. Three agents that all found nothing is low confidence.
5. Deduplicate recommended actions. Two specialists suggesting the same fix is one action.

Respond with JSON in exactly this shape, and nothing else:

{MERGED_CONTRACT}"""


def _passthrough(finding: dict[str, Any]) -> dict[str, Any]:
    """A single-investigator incident, normalised into the merged shape."""
    return {
        **finding,
        "contributing_domains": [finding.get("domain")] if finding.get("domain") else [],
        "disagreements": [],
        "confidence": finding.get("confidence", 0.7),
        "investigator_count": 1,
        "aggregated": False,
    }


def _findings_summary(findings: list[dict[str, Any]]) -> str:
    return "\n\n".join(
        json.dumps(
            {
                "investigator": f.get("domain", "unknown"),
                "focus": f.get("focus"),
                "root_cause": f.get("root_cause"),
                "severity": f.get("severity"),
                "impact": f.get("impact"),
                "evidence_items": f.get("evidence_items", []),
                "plc_registers": f.get("plc_registers", []),
                "recommended_actions": f.get("recommended_actions", []),
                "tools_used": [t.get("tool") for t in f.get("tools_used", [])],
            },
            indent=2,
        )
        for f in findings
    )


async def merge_findings(
    incident_id: str, findings: list[dict[str, Any]], model: ChatOpenAI
) -> dict[str, Any]:
    """Merges 2+ findings for one incident into a single consolidated finding."""
    base = findings[0]
    structurer = model.with_structured_output(MergedFinding, method="function_calling")

    try:
        merged: MergedFinding = await structurer.ainvoke(
            f"{SYSTEM_PROMPT}\n\n"
            f"Incident: {incident_id} ({base.get('cluster_name')})\n"
            f"{len(findings)} specialist findings to reconcile:\n\n"
            f"{_findings_summary(findings)}"
        )
    except Exception:
        logger.warning("Merge failed for %s; keeping highest-confidence finding", incident_id, exc_info=True)
        best = max(findings, key=lambda f: f.get("confidence", 0.0))
        return {
            **_passthrough(best),
            "investigator_count": len(findings),
            "aggregated": False,
            "disagreements": ["Aggregation failed; showing the single strongest finding."],
        }

    from agent.docket_shape import strip_emojis

    # PLC registers are factual lookups — union them rather than asking the LLM
    # to retype hex codes it could get wrong.
    registers: list[dict[str, Any]] = []
    seen_codes: set[str] = set()
    for finding in findings:
        for reg in finding.get("plc_registers", []) or []:
            if reg.get("code") not in seen_codes:
                seen_codes.add(reg.get("code"))
                registers.append(reg)

    tools_used = [t for f in findings for t in f.get("tools_used", []) or []]

    out = strip_emojis(merged.model_dump())
    out.update(
        {
            "incident_id": incident_id,
            "cluster_name": base.get("cluster_name"),
            "evidence": {
                f.get("domain", f"finding_{i}"): f.get("evidence", {})
                for i, f in enumerate(findings)
            },
            "plc_registers": registers,
            "tools_used": tools_used,
            "recommended_action": "; ".join(out.get("recommended_actions", [])),
            "investigator_count": len(findings),
            "aggregated": True,
        }
    )
    logger.info(
        "Aggregated %d findings for %s (confidence %.2f, %d disagreement(s))",
        len(findings), incident_id, out.get("confidence", 0.0), len(out.get("disagreements", [])),
    )
    return out


async def aggregator_node(state: dict[str, Any]) -> dict[str, Any]:
    """Graph node: fan-in from N investigators per incident to one finding each."""
    findings = state.get("investigator_findings", []) or []
    if not findings:
        return {"aggregated_findings": []}

    by_incident: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for finding in findings:
        by_incident[finding.get("incident_id", "UNKNOWN")].append(finding)

    needs_merge = {k: v for k, v in by_incident.items() if len(v) > 1}
    single = {k: v[0] for k, v in by_incident.items() if len(v) == 1}

    logger.info(
        "Aggregating %d finding(s): %d incident(s) single-investigator, %d multi-investigator",
        len(findings), len(single), len(needs_merge),
    )

    merged: dict[str, dict[str, Any]] = {k: _passthrough(v) for k, v in single.items()}

    if needs_merge:
        model = ChatOpenAI(model=MODEL_NAME, temperature=0, reasoning_effort="none")
        semaphore = asyncio.Semaphore(MAX_CONCURRENT)

        async def run(incident_id: str, group: list[dict[str, Any]]):
            async with semaphore:
                return incident_id, await merge_findings(incident_id, group, model)

        for incident_id, result in await asyncio.gather(
            *(run(k, v) for k, v in needs_merge.items())
        ):
            merged[incident_id] = result

    # Stable order: highest severity first, then by incident id, so the docket
    # and the UI list do not reshuffle between runs.
    severity_rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4, "NOMINAL": 5}
    ordered = sorted(
        merged.values(),
        key=lambda f: (severity_rank.get(str(f.get("severity", "LOW")).upper(), 9), f.get("incident_id", "")),
    )
    return {"aggregated_findings": ordered}


__all__ = ["MERGED_CONTRACT", "SYSTEM_PROMPT", "MergedFinding", "aggregator_node", "merge_findings"]
