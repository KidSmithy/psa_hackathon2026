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

import os
import re
import sys
from pathlib import Path
from dotenv import load_dotenv

for fname in [".env", "config.env", ".env.production"]:
    env_file = Path(__file__).resolve().parent.parent / fname
    if env_file.exists():
        load_dotenv(dotenv_path=env_file)

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

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

DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:5173",
]
custom_origins_env = os.getenv("ALLOWED_ORIGINS", "")
FRONTEND_ORIGINS = DEFAULT_ORIGINS + [o.strip() for o in custom_origins_env.split(",") if o.strip()]


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

if "*" in FRONTEND_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
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
    # Auto-detect source if not explicitly provided
    chosen_source = source
    if chosen_source is None and cluster_id:
        if cluster_id.upper().startswith("CLUSTER-"):
            chosen_source = "table"
        elif cluster_id.upper().startswith("INC-"):
            chosen_source = "live"

    try:
        clusters = get_clusters(source=chosen_source)
    except Exception as exc:
        logger.warning("Failed to get clusters with source=%s: %s", chosen_source, exc)
        clusters = {}

    if cluster_id is None:
        return clusters if clusters else get_clusters(source="table")

    if cluster_id in clusters:
        return {cluster_id: clusters[cluster_id]}

    # Fallback to alternative source if not found in primary
    alt_source = "table" if (chosen_source or STAGE1_SOURCE) == "live" else "live"
    try:
        alt_clusters = get_clusters(source=alt_source)
        if cluster_id in alt_clusters:
            logger.info("Found cluster_id '%s' in fallback source '%s'", cluster_id, alt_source)
            return {cluster_id: alt_clusters[cluster_id]}
    except Exception as exc:
        logger.warning("Fallback source '%s' failed: %s", alt_source, exc)

    raise HTTPException(
        status_code=404,
        detail=(
            f"Unknown cluster_id '{cluster_id}'. Available in primary ({chosen_source or STAGE1_SOURCE}): {sorted(clusters)}"
        ),
    )


def _finalize(result: dict[str, Any]) -> dict[str, Any]:
    """Shared by both endpoints: attaches linked_to and builds DocketItems."""
    run_timestamp = datetime.now(timezone.utc).isoformat()
    # Aggregated findings are one-per-incident; the raw list can hold several
    # per incident when the orchestrator assigned multiple specialists.
    findings = attach_linked_to(
        result.get("aggregated_findings") or result.get("investigator_findings", []),
        result.get("correlation"),
    )
    dockets = [to_docket_item(f, run_timestamp) for f in findings]
    return {
        "dockets": dockets,
        "correlation": result.get("correlation"),
        "docketResult": result.get("docket_result"),
        # Why each incident was routed where it was, and what the camera saw —
        # the UI needs these to show the orchestrator's reasoning.
        "orchestration": result.get("orchestration", {}),
        "videoFindings": result.get("video_findings", {}),
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


def _format_tool_output(output: Any) -> Any:
    """Extracts a clean serializable string/dict from tool output objects."""
    if output is None:
        return ""
    try:
        if isinstance(output, list):
            extracted = []
            for item in output:
                if hasattr(item, "text"):
                    extracted.append(item.text)
                elif isinstance(item, dict) and "text" in item:
                    extracted.append(item["text"])
                elif isinstance(item, str):
                    extracted.append(item)
                else:
                    extracted.append(str(item))
            return "\n".join(extracted) if extracted else str(output)
        if isinstance(output, (dict, str, int, float, bool)):
            return output
        return str(output)
    except Exception:
        return str(output)


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
        active_node = "video_analysis"
        yield f"data: {json.dumps({'type': 'node_status', 'node': 'started', 'output': {'cluster_id': cluster_id}})}\n\n"

        # From graph.py, which builds its nodes by iterating this same list. A
        # hand-written set here went stale when video_analysis/orchestrator/
        # aggregator were added: their outputs were never folded into
        # final_state, so the stream fell back to raw investigator_findings and
        # emitted duplicate DOCKET-{incident_id} ids for any incident the
        # orchestrator gave two specialists.
        from agent.graph import ALL_NODE_NAMES

        recognized_nodes = set(ALL_NODE_NAMES)

        try:
            async for event in graph.astream_events(
                {"clusters": clusters, "investigator_findings": []},
                version="v2",
                config={"callbacks": [app.state.langfuse_handler]},
            ):
                event_kind = event.get("event")
                event_name = event.get("name", "")
                data = event.get("data", {})

                # 1. Track Node Starts
                if event_kind == "on_chain_start" and event_name in recognized_nodes:
                    active_node = event_name
                    print(f"🤖 [LangGraph Node Start] node={event_name}", flush=True)
                    yield f"data: {json.dumps({'type': 'node_status', 'node': event_name, 'status': 'running'})}\n\n"

                # 2. Stream Real-Time Thoughts / Reasoning
                elif event_kind == "on_chat_model_stream":
                    chunk = data.get("chunk")
                    if chunk and getattr(chunk, "content", None):
                        content_str = chunk.content if isinstance(chunk.content, str) else ""
                        if content_str:
                            yield f"data: {json.dumps({'type': 'thought', 'node': active_node, 'chunk': content_str})}\n\n"

                # 3. Stream MCP Tool Invocations
                elif event_kind == "on_tool_start":
                    tool_name = event_name
                    tool_input = data.get("input", {})
                    # Clean internal actor_context from front-end display if present
                    if isinstance(tool_input, dict) and "actor_context" in tool_input:
                        tool_input = {k: v for k, v in tool_input.items() if k != "actor_context"}
                    print(f"🛠️ [MCP Tool Call] {tool_name}: {tool_input}", flush=True)
                    yield f"data: {json.dumps({'type': 'tool_start', 'node': active_node, 'tool': tool_name, 'input': tool_input, 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"

                elif event_kind == "on_tool_end":
                    tool_name = event_name
                    tool_output = _format_tool_output(data.get("output"))
                    print(f"✅ [MCP Tool Result] {tool_name} completed", flush=True)
                    yield f"data: {json.dumps({'type': 'tool_end', 'node': active_node, 'tool': tool_name, 'output': tool_output, 'status': 'completed'})}\n\n"

                # 4. Track Node Completions and Accumulate Final State
                elif event_kind == "on_chain_end" and event_name in recognized_nodes:
                    node_output = data.get("output")
                    if isinstance(node_output, dict):
                        print(f"🤖 [LangGraph Node Complete] node={event_name} keys={list(node_output.keys())}", flush=True)
                        for key, value in node_output.items():
                            if key == "investigator_findings":
                                final_state["investigator_findings"] = final_state.get(
                                    "investigator_findings", []
                                ) + value
                            else:
                                final_state[key] = value
                        yield f"data: {json.dumps({'type': 'node_output', 'node': event_name, 'output': node_output})}\n\n"

        except Exception as exc:
            print(f"❌ [API STREAM ERROR] {exc}", flush=True)
            logger.error("Investigation stream failed:\n%s", traceback.format_exc())
            yield f"data: {json.dumps({'type': 'error', 'node': 'error', 'output': {'message': str(exc)}})}\n\n"
            return

        print(f"🏁 [API STREAM COMPLETE] cluster_id={cluster_id}", flush=True)
        logger.info("GET /api/investigate/stream cluster_id=%s complete", cluster_id)
        yield f"data: {json.dumps({'type': 'complete', 'node': 'complete', 'output': _finalize(final_state)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

