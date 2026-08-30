"""
Shared state schema for the orchestrator-worker graph.

Kept deliberately raw (per LangGraph's own guidance): nodes store the plain
data they produced, not pre-formatted prompt text. Formatting happens inside
whichever node needs it.

Flow of the fields below:

    clusters            Stage 1 writes, everything reads
    video_findings      video_analysis writes, orchestrator reads
    assignments         orchestrator writes, assign_investigators reads
    investigator_findings   N investigators append, aggregator reads
    aggregated_findings aggregator writes, correlation + docket read
"""

from typing import Annotated, Any, TypedDict
import operator


class OverallState(TypedDict, total=False):
    # Stage 1 output — one entry per incident, keyed by incident id
    # (e.g. "INC-2026-0823-0001"). Shape matches stage1_bridge.get_clusters(),
    # which either runs the live clustering algorithm over raw_alerts or reads
    # the legacy pre-labelled incident_clusters table. The set is open: its
    # size is whatever the alert stream produced, not a fixed four.
    clusters: dict[str, dict[str, Any]]

    # Gemini's read of the CCTV clips attached to an incident, keyed by
    # incident id. A LIST because raw_alerts.video_id is alert-level: an
    # incident whose alerts came from two cameras has two clips. Absent key =
    # no footage; the orchestrator treats "no camera" and "camera saw nothing"
    # differently.
    video_findings: dict[str, list[dict[str, Any]]]

    # The orchestrator's routing decision: incident id -> list of assignments,
    # each naming a domain plus the question that investigator should answer.
    # A list because one incident can need several specialists.
    assignments: dict[str, list[dict[str, Any]]]

    # The orchestrator's reasoning, kept for the UI and for auditing why an
    # incident was routed the way it was.
    orchestration: dict[str, dict[str, Any]]

    # Every investigator worker appends one finding here. operator.add lets
    # LangGraph merge results from parallel Send() invocations safely — with
    # multi-agent assignment this can hold several entries per incident.
    investigator_findings: Annotated[list[dict[str, Any]], operator.add]

    # Exactly one finding per incident after the aggregator fans in. This, not
    # investigator_findings, is what correlation and the docket consume.
    aggregated_findings: list[dict[str, Any]]

    # Correlation agent's output: which findings are linked, and why.
    correlation: dict[str, Any]

    # Result of the final mcp-docket-service submission.
    docket_result: dict[str, Any]


class WorkerState(TypedDict, total=False):
    """What a single investigator worker receives via Send()."""

    cluster_id: str
    cluster_name: str
    target_entity: str
    matched_alerts: list[str]

    # Which investigator node owns this run.
    domain: str

    # From the orchestrator: why this specialist was picked and what it should
    # answer. Two investigators on one incident get different `focus` values —
    # that is the whole point of assigning both.
    focus: str
    assignment_reason: str

    # Context Stage 1 derived. Never includes raw_alerts.message — see
    # agent/facts.py for why.
    problem_type: str
    problem_type_label: str
    target_assets: list[str]
    is_singleton: bool
    priority_score: float

    # The video analyst's findings for this incident, if there was footage.
    video_findings: list[dict[str, Any]]

    investigator_findings: Annotated[list[dict[str, Any]], operator.add]
