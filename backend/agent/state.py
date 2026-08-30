"""
Shared state schema for the orchestrator-worker graph.

Kept deliberately raw (per LangGraph's own guidance): nodes store the plain
data they produced, not pre-formatted prompt text. Formatting happens inside
whichever node needs it.
"""

from typing import Annotated, Any, TypedDict
import operator


class OverallState(TypedDict):
    # Stage 1 output — one entry per incident, keyed by incident id
    # (e.g. "INC-2026-0823-0001"). Shape matches stage1_bridge.get_clusters(),
    # which either runs the live clustering algorithm over raw_alerts or reads
    # the legacy pre-labelled incident_clusters table. The set is open: its
    # size is whatever the alert stream produced, not a fixed four.
    clusters: dict[str, dict[str, Any]]

    # Every investigator worker appends one finding here. operator.add lets
    # LangGraph merge results from parallel Send() invocations safely.
    investigator_findings: Annotated[list[dict[str, Any]], operator.add]

    # Correlation agent's output: which findings are linked, and why.
    correlation: dict[str, Any]

    # Result of the final mcp-docket-service submission.
    docket_result: dict[str, Any]


class WorkerState(TypedDict):
    """What a single investigator worker receives via Send()."""

    cluster_id: str
    cluster_name: str
    target_entity: str
    matched_alerts: list[str]

    # Which investigator node owns this incident, derived from problem_type.
    domain: str

    # Open-clustering context. An investigator can no longer assume it is
    # looking at one of four known scenarios, so it is told what kind of
    # problem this is and which concrete assets are involved.
    problem_type: str
    problem_type_label: str
    target_assets: list[str]
    is_singleton: bool
    priority_score: float

    investigator_findings: Annotated[list[dict[str, Any]], operator.add]
