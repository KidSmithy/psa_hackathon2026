"""
Yard Model & Topology Engine for PSA Tuas Smart Port Terminal.

Defines shared terminal resources (lanes, junctions, charger bays, quay cranes, sectors),
their representative coordinates (metres), and the topological adjacency graph.
Enables ST-DBSCAN+Topology clustering to group alerts across physically connected
assets even when separated by distance.
"""

from typing import Any, Dict, List, Optional, Set, Tuple

# resourceId -> (resourceType, representativePoint (x, y))
RESOURCES: Dict[str, Tuple[str, Tuple[float, float]]] = {
    "JUNCTION-L7-A": ("junction", (412.0, 118.0)),
    "JUNCTION-L7-B": ("junction", (505.0, 118.0)),
    "LANE-7": ("lane", (455.0, 118.0)),
    "LANE-3": ("lane", (300.0, 180.0)),
    "LANE-4": ("lane", (220.0, 180.0)),
    "LANE-8": ("lane", (660.0, 290.0)),
    "LANE-12": ("lane", (660.0, 380.0)),
    "CHARGER-B1": ("charger", (150.0, 80.0)),
    "CHARGER-B3": ("charger", (298.0, 62.0)),
    # BCSS-03 is present in bcss_chargers, asset_relationships and
    # maintenance_records but was missing here, so alerts from it fell back to
    # the default yard position and scored no charger_capacity_risk. The
    # B1/B3 numbering is historical and does not track the BCSS-0n numbers.
    "CHARGER-B4": ("charger", (200.0, 62.0)),
    "SECTOR-A": ("sector", (480.0, 80.0)),
    "QC-03-HANDOFF": ("crane_handoff", (150.0, 400.0)),
    "QC-04-HANDOFF": ("crane_handoff", (182.0, 240.0)),
    "QC-05-HANDOFF": ("crane_handoff", (246.0, 240.0)),
}

# Synonyms/aliases mapping common DB names or location strings to canonical resource IDs
RESOURCE_ALIASES: Dict[str, str] = {
    "Lane_7": "LANE-7",
    "LANE_7": "LANE-7",
    "Lane 7": "LANE-7",
    "Lane_4": "LANE-4",
    "LANE_4": "LANE-4",
    "Lane 4": "LANE-4",
    "Lane_3": "LANE-3",
    "LANE_3": "LANE-3",
    "Lane 3": "LANE-3",
    "Station_BCSS_02": "CHARGER-B3",
    "BCSS-02": "CHARGER-B3",
    "BCSS_02": "CHARGER-B3",
    "Station_BCSS_01": "CHARGER-B1",
    "BCSS-01": "CHARGER-B1",
    "BCSS_01": "CHARGER-B1",
    "Station_BCSS_03": "CHARGER-B4",
    "BCSS-03": "CHARGER-B4",
    "BCSS_03": "CHARGER-B4",
    "Sector_A": "SECTOR-A",
    "SECTOR_A": "SECTOR-A",
    "Sector A": "SECTOR-A",
    "QC-03": "QC-03-HANDOFF",
    "QC_03": "QC-03-HANDOFF",
    "QC-04": "QC-04-HANDOFF",
    "QC_04": "QC-04-HANDOFF",
    "QC-05": "QC-05-HANDOFF",
    "QC_05": "QC-05-HANDOFF",
}

# Undirected physical adjacency edges
EDGES: List[Tuple[str, str]] = [
    ("LANE-7", "JUNCTION-L7-A"),
    ("LANE-7", "JUNCTION-L7-B"),
    ("JUNCTION-L7-A", "LANE-3"),
    ("LANE-3", "CHARGER-B3"),
    ("LANE-3", "LANE-4"),
    ("LANE-3", "QC-04-HANDOFF"),
    ("QC-03-HANDOFF", "QC-04-HANDOFF"),
    ("QC-04-HANDOFF", "QC-05-HANDOFF"),
    ("CHARGER-B1", "CHARGER-B3"),
    ("CHARGER-B4", "CHARGER-B1"),
    ("CHARGER-B3", "SECTOR-A"),
    ("LANE-4", "CHARGER-B1"),
    ("JUNCTION-L7-A", "LANE-8"),
    ("LANE-8", "JUNCTION-L7-B"),
    ("LANE-8", "LANE-12"),
    ("QC-05-HANDOFF", "LANE-12"),
]

# Reporting zone for each resource
ZONE_OF: Dict[str, str] = {
    "JUNCTION-L7-A": "LANE-7",
    "JUNCTION-L7-B": "LANE-7",
    "LANE-7": "LANE-7",
    "LANE-3": "LANE-3",
    "LANE-4": "LANE-4",
    "LANE-8": "LANE-8",
    "LANE-12": "LANE-12",
    "CHARGER-B1": "YARD-B1",
    "CHARGER-B3": "YARD-B3",
    "CHARGER-B4": "YARD-B4",
    "SECTOR-A": "SECTOR-A",
    "QC-03-HANDOFF": "QUAY-03",
    "QC-04-HANDOFF": "QUAY-04",
    "QC-05-HANDOFF": "QUAY-05",
}

NAMED_FEATURE: Dict[str, str] = {
    "JUNCTION-L7-A": "Junction L7-A",
    "JUNCTION-L7-B": "Junction L7-B",
    "LANE-7": "Lane 7 mainline",
    "LANE-3": "Lane 3 mainline",
    "LANE-4": "Lane 4 transfer corridor",
    "LANE-8": "Lane 8 buffer lane",
    "LANE-12": "Lane 12 outbound lane",
    "CHARGER-B1": "BCSS Charger B1 (BCSS-01)",
    "CHARGER-B3": "BCSS Charger B3 (BCSS-02)",
    "CHARGER-B4": "BCSS Charger B4 (BCSS-03)",
    "SECTOR-A": "Sector A staging buffer",
    "QC-03-HANDOFF": "QC-03 handoff apron (Berth 1)",
    "QC-04-HANDOFF": "QC-04 handoff apron (Berth 2)",
    "QC-05-HANDOFF": "QC-05 handoff apron (Berth 3)",
}

CRANE_OF: Dict[str, str] = {
    "QC-03-HANDOFF": "QC-03",
    "QC-04-HANDOFF": "QC-04",
    "QC-05-HANDOFF": "QC-05",
}

# Pre-computed adjacency graph
_ADJ: Dict[str, Set[str]] = {r: set() for r in RESOURCES}
for _a, _b in EDGES:
    if _a in _ADJ and _b in _ADJ:
        _ADJ[_a].add(_b)
        _ADJ[_b].add(_a)


def canonical_resource_id(res_id: Optional[str]) -> Optional[str]:
    """Resolves aliases or variations to canonical resource ID."""
    if not res_id:
        return None
    if res_id in RESOURCES:
        return res_id
    if res_id in RESOURCE_ALIASES:
        return RESOURCE_ALIASES[res_id]
    return res_id


def resource_type(res_id: Optional[str]) -> Optional[str]:
    c_id = canonical_resource_id(res_id)
    entry = RESOURCES.get(c_id) if c_id else None
    return entry[0] if entry else None


def resource_point(res_id: Optional[str]) -> Optional[Tuple[float, float]]:
    c_id = canonical_resource_id(res_id)
    entry = RESOURCES.get(c_id) if c_id else None
    return entry[1] if entry else None


def topology_linked(a: Optional[str], b: Optional[str], max_hops: int = 1) -> bool:
    """Returns True if resources a and b are identical or within max_hops on the graph."""
    a_can = canonical_resource_id(a)
    b_can = canonical_resource_id(b)

    if not a_can or not b_can:
        return False
    if a_can == b_can:
        return True
    if a_can not in _ADJ or b_can not in _ADJ:
        return False

    frontier, seen = {a_can}, {a_can}
    for _ in range(max_hops):
        nxt = set()
        for node in frontier:
            for peer in _ADJ.get(node, ()):
                if peer == b_can:
                    return True
                if peer not in seen:
                    seen.add(peer)
                    nxt.add(peer)
        frontier = nxt
        if not frontier:
            break
    return False


def graph_for_viewer() -> Dict[str, Any]:
    """Serialisable dictionary for HTML/Visualizer rendering."""
    return {
        "nodes": [
            {
                "id": rid,
                "type": rtype,
                "x": pt[0],
                "y": pt[1],
                "label": NAMED_FEATURE.get(rid, rid),
                "zoneId": ZONE_OF.get(rid, "YARD-UNKNOWN"),
            }
            for rid, (rtype, pt) in RESOURCES.items()
        ],
        "edges": [{"from": a, "to": b} for a, b in EDGES],
        "extent": {"xMax": 850, "yMax": 480},
    }
