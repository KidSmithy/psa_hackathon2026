"""
Entry point: runs Stage 1 over the live alert stream, then runs the graph
once against every incident it produced, and prints the result.

Usage (from backend/, inside the venv):
    python -m agent.run                 # live open clustering (default)
    python -m agent.run --source table  # legacy pre-labelled incident_clusters
    python -m agent.run --incident INC-2026-0823-0001   # just one incident
"""

import argparse
import asyncio
import json

from agent.graph import build_graph
from agent.stage1_bridge import get_clusters
from agent.tracing import get_langfuse_handler


async def main(source: str | None, incident: str | None) -> None:
    clusters = get_clusters(source=source)
    if not clusters:
        print("Stage 1 produced no clusters for this alert batch — nothing to investigate.")
        return

    if incident:
        if incident not in clusters:
            print(f"No incident '{incident}'. Stage 1 produced: {sorted(clusters)}")
            return
        clusters = {incident: clusters[incident]}

    print(f"Stage 1 produced {len(clusters)} incident(s):")
    for cid, c in clusters.items():
        marker = " [singleton]" if c.get("is_singleton") else ""
        print(f"  {cid}  {c.get('problem_type', 'n/a'):<20} -> {c.get('domain')}{marker}")
        print(f"      {c['cluster_name']}  ({len(c.get('matched_alerts', []))} alerts)")
    print()

    graph, client = await build_graph()
    handler = get_langfuse_handler()

    result = await graph.ainvoke(
        {"clusters": clusters, "investigator_findings": []},
        config={"callbacks": [handler]},
    )

    print(json.dumps(
        {
            "investigator_findings": result["investigator_findings"],
            "correlation": result.get("correlation"),
            "docket_result": result.get("docket_result"),
        },
        indent=2,
    ))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the PSA incident triage graph once")
    parser.add_argument(
        "--source",
        choices=["live", "table"],
        default=None,
        help="Stage 1 source; defaults to STAGE1_SOURCE in backend/.env (live)",
    )
    parser.add_argument(
        "--incident",
        default=None,
        help="Investigate only this incident id instead of every one Stage 1 produced",
    )
    args = parser.parse_args()
    asyncio.run(main(args.source, args.incident))
