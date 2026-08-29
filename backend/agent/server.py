"""
HTTP API for the LangGraph triage pipeline — the frontend calls this instead
of running backend/agent/run.py by hand.

Two ways to run an investigation:
  - POST /api/investigate         : run to completion, return the final result.
  - GET  /api/investigate/stream  : Server-Sent Events, one event per node as
                                     it finishes, for the frontend's live
                                     "agent spawning" animation.

Both accept an optional cluster_id to investigate a single real cluster
(e.g. "CLUSTER-A") instead of every cluster currently in the database.

Run with (from backend/, inside the venv):
    uvicorn agent.server:app --reload --port 8000

Every request, every node finishing, and every failure is logged to the
console at INFO level — nothing here fails silently.
"""

import json
import logging
import traceback
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent.docket import attach_linked_to
from agent.docket_shape import to_docket_item
from agent.graph import build_graph
from agent.stage1_bridge import get_incident_clusters

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("psa_agent.server")

FRONTEND_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Built once at startup, not per-request — building it launches the 3 MCP
    # servers as subprocesses, which is too slow to redo on every call.
    logger.info("Building graph and connecting to MCP servers...")
    try:
        graph, client = await build_graph()
    except Exception:
        logger.error("Failed to build graph at startup:\n%s", traceback.format_exc())
        raise
    app.state.graph = graph
    app.state.mcp_client = client
    logger.info("Graph built. Ready to accept requests.")
    yield


app = FastAPI(title="PSA Incident Triage Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InvestigateRequest(BaseModel):
    cluster_id: Optional[str] = None


def _select_clusters(cluster_id: Optional[str]) -> dict[str, Any]:
    clusters = get_incident_clusters()
    if cluster_id is None:
        return clusters
    if cluster_id not in clusters:
        raise HTTPException(status_code=404, detail=f"Unknown cluster_id '{cluster_id}'")
    return {cluster_id: clusters[cluster_id]}


def _finalize(result: dict[str, Any]) -> dict[str, Any]:
    """Shared by both endpoints: attaches linked_to and builds DocketItems."""
    run_timestamp = datetime.now(timezone.utc).isoformat()
    findings = attach_linked_to(result.get("investigator_findings", []), result.get("correlation"))
    dockets = [to_docket_item(f, run_timestamp) for f in findings]
    return {
        "dockets": dockets,
        "correlation": result.get("correlation"),
        "docketResult": result.get("docket_result"),
    }


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/investigate")
async def investigate(body: InvestigateRequest) -> dict[str, Any]:
    logger.info("POST /api/investigate cluster_id=%s", body.cluster_id)
    clusters = _select_clusters(body.cluster_id)
    try:
        result = await app.state.graph.ainvoke({"clusters": clusters, "investigator_findings": []})
    except Exception as exc:
        logger.error("Investigation failed:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    logger.info("POST /api/investigate cluster_id=%s complete", body.cluster_id)
    return _finalize(result)


@app.get("/api/investigate/stream")
async def investigate_stream(cluster_id: Optional[str] = Query(default=None)) -> StreamingResponse:
    logger.info("GET /api/investigate/stream cluster_id=%s", cluster_id)
    clusters = _select_clusters(cluster_id)
    graph = app.state.graph

    async def event_stream() -> AsyncIterator[str]:
        final_state: dict[str, Any] = {"investigator_findings": []}
        try:
            async for update in graph.astream(
                {"clusters": clusters, "investigator_findings": []}, stream_mode="updates"
            ):
                for node_name, node_output in update.items():
                    if not node_output:
                        continue
                    logger.info("node finished: %s -> keys=%s", node_name, list(node_output.keys()))
                    for key, value in node_output.items():
                        if key == "investigator_findings":
                            final_state["investigator_findings"] = final_state.get(
                                "investigator_findings", []
                            ) + value
                        else:
                            final_state[key] = value
                    yield f"data: {json.dumps({'node': node_name, 'output': node_output})}\n\n"
        except Exception as exc:
            logger.error("Investigation stream failed:\n%s", traceback.format_exc())
            yield f"data: {json.dumps({'node': 'error', 'output': {'message': str(exc)}})}\n\n"
            return

        logger.info("GET /api/investigate/stream cluster_id=%s complete", cluster_id)
        yield f"data: {json.dumps({'node': 'complete', 'output': _finalize(final_state)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
