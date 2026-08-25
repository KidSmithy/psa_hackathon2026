"""
Shared state schema for the orchestrator-worker graph.

Kept deliberately raw (per LangGraph's own guidance): nodes store the plain
data they produced, not pre-formatted prompt text. Formatting happens inside
whichever node needs it.
"""

from typing import Annotated, Any, TypedDict
import operator


class OverallState(TypedDict):
    # Stage 1 output — one entry per incident cluster, keyed by cluster_id.
    # Shape matches mock_data.get_stage1_clusters() in backend/mcp/mock_data.py.
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
    investigator_findings: Annotated[list[dict[str, Any]], operator.add]
