"""
Entry point: runs the graph once against every incident cluster currently
sitting in the real Supabase incident_clusters table, and prints the result.

Usage (from backend/, inside the venv):
    python -m agent.run
"""

import asyncio
import json

from agent.graph import build_graph
from agent.stage1_bridge import get_incident_clusters
from agent.tracing import get_langfuse_handler


async def main() -> None:
    clusters = get_incident_clusters()
    if not clusters:
        print("Stage 1 produced no clusters for this alert batch — nothing to investigate.")
        return

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
    asyncio.run(main())
