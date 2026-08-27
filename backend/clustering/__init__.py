"""
PSA Stage 1 Deterministic Clustering & Noise Filtering Package.

Provides ST-DBSCAN + Topology clustering, monotonic Noisy-OR priority scoring,
safety stream escalation routing, and alert normalization conforming to
AGV Exception Handling Schema Version 1.1.0.
"""

from .adapter import is_noise_alert, normalize_alert_batch, normalize_db_alert
from .filter import (
    CLUSTERING_METHOD,
    FAULT_SEVERITY,
    PRIORITY_WEIGHTS,
    SCHEMA_VERSION,
    build_cluster,
    build_escalation,
    cluster_alerts,
    is_safety_alert,
    run_clustering,
    score_cluster,
)
from . import yard

__all__ = [
    "SCHEMA_VERSION",
    "CLUSTERING_METHOD",
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
