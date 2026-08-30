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
from agent.stage1_bridge import get_incident_clusters

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
    print(f"\n⚡ [API TRIGGER] POST /api/investigate cluster_id={body.cluster_id}", flush=True)
    logger.info("POST /api/investigate cluster_id=%s", body.cluster_id)
    clusters = _select_clusters(body.cluster_id)
    try:
        result = await app.state.graph.ainvoke({"clusters": clusters, "investigator_findings": []})
    except Exception as exc:
        print(f"❌ [API ERROR] Investigation failed: {exc}", flush=True)
        logger.error("Investigation failed:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    print(f"✅ [API COMPLETE] POST /api/investigate cluster_id={body.cluster_id}", flush=True)
    logger.info("POST /api/investigate cluster_id=%s complete", body.cluster_id)
    return _finalize(result)


@app.get("/api/investigate/stream")
async def investigate_stream(cluster_id: Optional[str] = Query(default=None)) -> StreamingResponse:
    print(f"\n⚡ [API STREAM START] GET /api/investigate/stream cluster_id={cluster_id}", flush=True)
    logger.info("GET /api/investigate/stream cluster_id=%s", cluster_id)
    clusters = _select_clusters(cluster_id)
    print(f"🔍 [API CLUSTERS] Target clusters: {list(clusters.keys())}", flush=True)
    graph = app.state.graph

    async def event_stream() -> AsyncIterator[str]:
        final_state: dict[str, Any] = {"investigator_findings": []}
        yield f"data: {json.dumps({'node': 'started', 'output': {'cluster_id': cluster_id}})}\n\n"
        try:
            async for update in graph.astream(
                {"clusters": clusters, "investigator_findings": []}, stream_mode="updates"
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


class DraftEmailRequest(BaseModel):
    action: str
    docket: Optional[dict[str, Any]] = None


class DraftEmailResponse(BaseModel):
    requires_dispatch_email: bool = Field(
        description="True if the action requires human field technician/crew dispatch, manual inspection, or physical on-site intervention. False if it is a purely automated software/TOS command."
    )
    recipient: str = Field(
        default="tuas-maintenance-lead@psa.sg, field-crew-sectorA@psa.sg",
        description="Comma-separated email addresses appropriate for this incident type and location."
    )
    subject: str = Field(
        description="Clear, urgent email subject line including equipment ID, issue, and location."
    )
    priority: str = Field(
        description="CRITICAL, HIGH, MEDIUM, or LOW"
    )
    body: str = Field(
        description="A concise, professional single-paragraph email body addressing the field maintenance team with the specific directives, target asset/lane, key fault context, and safety precautions."
    )
    reasoning: str = Field(
        description="Short reasoning for classification and email content."
    )


@app.post("/api/actions/draft-email", response_model=DraftEmailResponse)
async def draft_email(body: DraftEmailRequest) -> DraftEmailResponse:
    print(f"\n✉️ [API DRAFT EMAIL] Action: {body.action[:80]}...", flush=True)
    logger.info("POST /api/actions/draft-email action=%s", body.action)
    try:
        from langchain_openai import ChatOpenAI

        model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        model = ChatOpenAI(model=model_name, temperature=0.2)
        structurer = model.with_structured_output(DraftEmailResponse, method="function_calling")

        docket_ctx = body.docket or {}
        title = docket_ctx.get("title", "Port Incident")
        severity = docket_ctx.get("severity", "HIGH")
        root_cause = docket_ctx.get("rootCause", "SCADA sensor anomaly")
        impact = docket_ctx.get("impact", "Terminal throughput constrained")
        evidence = docket_ctx.get("physicalEvidence", [])
        registers = docket_ctx.get("plcRegisters", [])

        prompt = (
            "You are the PSA Tuas Port Operational Copilot AI.\n"
            "An incident investigation is ongoing in the automated container terminal.\n\n"
            f"Incident Docket Context:\n"
            f"- Incident Title: {title}\n"
            f"- Severity: {severity}\n"
            f"- Downstream Impact: {impact}\n"
            f"- Verified Root Cause: {root_cause}\n"
            f"- Decoded PLC Registers: {json.dumps(registers)}\n"
            f"- Multimodal Evidence: {json.dumps([e.get('text', '') for e in evidence if isinstance(e, dict)])}\n\n"
            f"Authorized Operator Action Directive:\n"
            f"\"{body.action}\"\n\n"
            "Task:\n"
            "1. Evaluate if this action requires human field technician/crew dispatch, manual inspection, or physical maintenance intervention on site.\n"
            "2. If YES (human technician dispatch required):\n"
            "   - set requires_dispatch_email = true\n"
            "   - specify appropriate recipient (e.g. tuas-maintenance-lead@psa.sg, field-crew-sectorA@psa.sg)\n"
            "   - compose an urgent, specific Subject line with the asset ID and location\n"
            "   - write a single concise paragraph (3-5 sentences) for the email body. Address the maintenance team directly, concisely summarizing the asset location, the exact diagnostic root cause / fault context, the specific physical inspection directive to execute, and safety precautions (such as keeping the vehicle halted/lane isolated). Do NOT use bullet points, greetings on their own line, or multiple paragraphs—write one coherent, natural single paragraph.\n"
            "3. If NO (purely automated software command, TOS queue reroute, remote reset with no human crew needed):\n"
            "   - set requires_dispatch_email = false."
        )

        result: DraftEmailResponse = await structurer.ainvoke(prompt)
        print(f"✅ [API DRAFT EMAIL] requires_dispatch={result.requires_dispatch_email} subject={result.subject}", flush=True)
        return result
    except Exception as exc:
        print(f"⚠️ [API DRAFT EMAIL FALLBACK] {exc}", flush=True)
        logger.error("Draft email LLM generation failed: %s", exc)
        is_field = bool(
            re.search(
                r"dispatch|technician|crew|inspect|maintenance|manual|engineer|mechanic|send|lock|pin",
                body.action,
                re.IGNORECASE,
            )
        )
        docket_title = body.docket.get("title", "Tuas Terminal Operations") if body.docket else "Tuas Operations"
        return DraftEmailResponse(
            requires_dispatch_email=is_field,
            recipient="tuas-maintenance-lead@psa.sg, field-crew-sectorA@psa.sg",
            subject=f"[URGENT WORK ORDER] Technician Dispatch: Field Action Required ({docket_title})",
            priority="HIGH",
            body=(
                f"Hi Maintenance Team, please urgently dispatch a field technician to carry out the authorized directive: {body.action}. "
                f"This follows an active incident ({docket_title}) where root cause analysis verified {body.docket.get('rootCause', 'an active SCADA fault') if body.docket else 'a mechanical/actuator fault'}. "
                f"Please ensure all safety interlocks and lane isolation protocols are adhered to during on-site inspection and confirm resolution back to Tuas Operations Control upon completion."
            ),
            reasoning="Determined via operational dispatch classifier.",
        )

