"""
Mock Data & Stage 1 Prototype Cluster Definitions

Maps alerts and scenarios according to the Port Terminal Incident Investigation specification.
"""

from typing import Any, Dict, List

MOCK_STAGE1_CLUSTERS: Dict[str, Dict[str, Any]] = {
    "Cluster_A": {
        "cluster_name": "Lane 7 Bottleneck",
        "raw_alert_ids": [
            "ALT-001", "ALT-002", "ALT-003",
            "ALT-004", "ALT-005", "ALT-006",
            "ALT-007", "ALT-008", "ALT-009"
        ],
        "target_entity": "Lane_7",
    },
    "Cluster_B": {
        "cluster_name": "BCSS Charger Trip",
        "raw_alert_ids": [
            "ALT-010", "ALT-011", "ALT-012",
            "ALT-013", "ALT-014", "ALT-015"
        ],
        "target_entity": "BCSS-02",
    },
}


def get_stage1_clusters(raw_alerts: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Deterministic Filter (Stage 1):
    Maps incoming raw alerts to incident clusters based on predefined spatial-temporal rules.
    """
    matched_clusters = {}
    alert_set = set(raw_alerts)
    for cluster_id, cluster_info in MOCK_STAGE1_CLUSTERS.items():
        overlap = alert_set.intersection(set(cluster_info["raw_alert_ids"]))
        if overlap:
            matched_clusters[cluster_id] = {
                **cluster_info,
                "matched_alerts": sorted(list(overlap)),
            }
    return matched_clusters
