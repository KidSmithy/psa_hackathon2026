"""
PSA Stage 1 Deterministic Clustering & Noise Filtering Package.

Provides open (problem-type gated) ST-DBSCAN + Topology clustering, monotonic
Noisy-OR priority scoring, safety stream escalation routing, and alert
normalization conforming to AGV Exception Handling Schema Version 1.1.0.

"Open" means the incident count is not fixed and not configured: alerts group
only with alerts describing the same kind of problem, and anything that
correlates with nothing stays a single-alert incident.
"""

from .adapter import is_noise_alert, normalize_alert_batch, normalize_db_alert
from .filter import (
    CLUSTERING_METHOD,
    CLUSTERING_METHOD_OPEN,
    CLUSTERING_METHOD_SPATIOTEMPORAL,
    DEFAULT_GROUP_BY_PROBLEM_TYPE,
    FAULT_SEVERITY,
    PRIORITY_WEIGHTS,
    SCHEMA_VERSION,
    build_cluster,
    build_escalation,
    cluster_alerts,
    is_safety_alert,
    resolve_config,
    run_clustering,
    score_cluster,
)
from .problem_types import (
    PROBLEM_TYPES,
    PROBLEM_TYPE_LABEL,
    agent_for,
    domain_for,
    dominant_problem_type,
    problem_type,
)
from . import problem_types, yard

__all__ = [
    "SCHEMA_VERSION",
    "CLUSTERING_METHOD",
    "CLUSTERING_METHOD_OPEN",
    "CLUSTERING_METHOD_SPATIOTEMPORAL",
    "DEFAULT_GROUP_BY_PROBLEM_TYPE",
    "resolve_config",
    "problem_types",
    "PROBLEM_TYPES",
    "PROBLEM_TYPE_LABEL",
    "problem_type",
    "dominant_problem_type",
    "domain_for",
    "agent_for",
    "FAULT_SEVERITY",
    "PRIORITY_WEIGHTS",
    "run_clustering",
    "cluster_alerts",
    "score_cluster",
    "build_cluster",
    "build_escalation",
    "is_safety_alert",
    "normalize_db_alert",
    "normalize_alert_batch",
    "is_noise_alert",
    "yard",
]
