"""
HTTP API for the LangGraph triage pipeline — the frontend calls this instead
of running backend/agent/run.py by hand.

Two ways to run an investigation:
  - POST /api/investigate         : run to completion, return the final result.
  - GET  /api/investigate/stream  : Server-Sent Events, one event per node as
                                     it finishes, for the frontend's live
                                     "agent spawning" animation.

Both accept an optional cluster_id to investigate a single incident (e.g.
"INC-2026-0823-0001") instead of every incident Stage 1 currently produces.

Stage 1 itself is exposed too:
  - GET  /api/stage1          : run the open clustering algorithm over
                                raw_alerts and return the incidents it found,
                                without investigating anything.
  - POST /api/stage1/persist  : same, then write the result to the v2 tables.

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
from agent.stage1_bridge import STAGE1_SOURCE, get_clusters
from agent.stage1_pipeline import fetch_raw_inputs, persist, run_stage1, to_cluster_row
from agent.tracing import get_langfuse_handler
import sys

# Force immediate unbuffered flushing to terminal
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(line_buffering=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True,
)
logger = logging.getLogger("psa_agent.server")

FRONTEND_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:5173",
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
    # Built once, reused for every request — same reason as the graph itself.
    app.state.langfuse_handler = get_langfuse_handler()
    logger.info("Graph built. Ready to accept requests.")
    yield


app = FastAPI(title="PSA Incident Triage Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
)


class InvestigateRequest(BaseModel):
    cluster_id: Optional[str] = None
    # "live" runs the clustering algorithm over raw_alerts; "table" reads the
    # legacy hand-seeded incident_clusters snapshot. Defaults to STAGE1_SOURCE.
    source: Optional[str] = None


class PersistRequest(BaseModel):
    source: Optional[str] = None
    # False appends this run alongside earlier ones instead of replacing them.
    replace: bool = True


def _select_clusters(cluster_id: Optional[str], source: Optional[str] = None) -> dict[str, Any]:
    clusters = get_clusters(source=source)
    if cluster_id is None:
        return clusters
    if cluster_id not in clusters:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Unknown cluster_id '{cluster_id}'. Incident ids are generated per Stage 1 "
                f"run — currently available: {sorted(clusters)}"
            ),
        )
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
    return {"status": "ok", "stage1Source": STAGE1_SOURCE}


@app.get("/api/stage1")
async def stage1() -> dict[str, Any]:
    """
    Runs open clustering over the live raw_alerts stream and returns what it
    found. Read-only — nothing is written to any table.
    """
    logger.info("GET /api/stage1")
    try:
        raw_alerts, telemetry = fetch_raw_inputs()
        result = run_stage1(raw_alerts, telemetry)
    except Exception as exc:
        logger.error("Stage 1 failed:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    raw_by_id = {str(r.get("id")): r for r in raw_alerts}
    return {
        "stats": result["stats"],
        "clusters": [to_cluster_row(c, raw_by_id, run_id="preview") for c in result["clusters"]],
        "escalations": result["escalations"],
        "noiseAlertIds": [str(n.get("id")) for n in result["noise"]],
    }


@app.post("/api/stage1/persist")
async def stage1_persist(body: PersistRequest) -> dict[str, Any]:
    """
    Runs Stage 1 and writes the result to incident_clusters_v2 /
    safety_escalations / stage1_runs. The original incident_clusters table is
    left untouched.
    """
    logger.info("POST /api/stage1/persist replace=%s", body.replace)
    try:
        raw_alerts, telemetry = fetch_raw_inputs()
        result = run_stage1(raw_alerts, telemetry)
        return persist(result, raw_alerts, replace=body.replace)
    except Exception as exc:
        logger.error("Stage 1 persist failed:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/investigate")
async def investigate(body: InvestigateRequest) -> dict[str, Any]:
    print(f"\n⚡ [API TRIGGER] POST /api/investigate cluster_id={body.cluster_id}", flush=True)
    logger.info("POST /api/investigate cluster_id=%s source=%s", body.cluster_id, body.source)
    clusters = _select_clusters(body.cluster_id, body.source)
    try:
        result = await app.state.graph.ainvoke(
            {"clusters": clusters, "investigator_findings": []},
            config={"callbacks": [app.state.langfuse_handler]},
        )
    except Exception as exc:
        print(f"❌ [API ERROR] Investigation failed: {exc}", flush=True)
        logger.error("Investigation failed:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    print(f"✅ [API COMPLETE] POST /api/investigate cluster_id={body.cluster_id}", flush=True)
    logger.info("POST /api/investigate cluster_id=%s complete", body.cluster_id)
    return _finalize(result)


@app.get("/api/investigate/stream")
async def investigate_stream(
    cluster_id: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
) -> StreamingResponse:
    print(f"\n⚡ [API STREAM START] GET /api/investigate/stream cluster_id={cluster_id}", flush=True)
    logger.info("GET /api/investigate/stream cluster_id=%s source=%s", cluster_id, source)
    clusters = _select_clusters(cluster_id, source)
    print(f"🔍 [API CLUSTERS] Target clusters: {list(clusters.keys())}", flush=True)
    graph = app.state.graph

    async def event_stream() -> AsyncIterator[str]:
        final_state: dict[str, Any] = {"investigator_findings": []}
        yield f"data: {json.dumps({'node': 'started', 'output': {'cluster_id': cluster_id}})}\n\n"
        try:
            async for update in graph.astream(
                {"clusters": clusters, "investigator_findings": []},
                stream_mode="updates",
                config={"callbacks": [app.state.langfuse_handler]},
            ):
                for node_name, node_output in update.items():
                    if not node_output:
                        continue
                    print(f"🤖 [LangGraph Node Complete] node={node_name} keys={list(node_output.keys())}", flush=True)
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
            print(f"❌ [API STREAM ERROR] {exc}", flush=True)
            logger.error("Investigation stream failed:\n%s", traceback.format_exc())
            yield f"data: {json.dumps({'node': 'error', 'output': {'message': str(exc)}})}\n\n"
            return

        print(f"🏁 [API STREAM COMPLETE] cluster_id={cluster_id}", flush=True)
        logger.info("GET /api/investigate/stream cluster_id=%s complete", cluster_id)
        yield f"data: {json.dumps({'node': 'complete', 'output': _finalize(final_state)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
