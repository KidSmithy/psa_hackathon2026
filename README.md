# PSA Tuas Smart Port Operations - Powered by Sherlock AI

---

## Table of Contents

1. [What is Sherlock AI?](#what-is-sherlock-ai)
2. [How Sherlock AI Works](#how-sherlock-ai-works)
3. [Sherlock AI Walkthrough](#sherlock-ai-walkthrough)
4. [System Architecture Diagram](#system-architecture-diagram)
5. [Tech Stack Used](#tech-stack-used)
6. [Responsible & Transparent AI](#responsible--transparent-ai)
7. [Security](#security)
8. [Future Plans](#future-plans)

---

## What is Sherlock AI?

Sherlock AI is an agentic incident triage workflow for PSA's Tuas Port operations. It clusters raw AGV sensor alerts into incidents, reviews any CCTV footage attached to those incidents, and lets an orchestrator agent decide which specialist investigator agent(s) should examine each one. It then correlates root causes across related incidents and hands every finding to a human, who accepts or rejects the recommended action.

---

## How Sherlock AI Works

1. **Cluster raw alerts into incidents.** Sherlock AI groups raw AGV sensor alerts that describe the same underlying problem, based on their location, timing, and fault type, into a single incident.
2. **Review any CCTV footage.** If an incident has camera footage linked to it, a video analyst agent watches the clip and reports what it sees, independent of what the sensor alerts say.
3. **Decide who investigates.** An orchestrator agent weighs the alert data against the video finding and assigns one or more specialist investigator agents to the incident.
4. **Investigate with real tools.** Each assigned investigator agent gathers evidence using domain specific tools, such as telemetry readings, PLC fault codes, and maintenance history, then proposes a root cause and a recommended action.
5. **Reconcile multiple findings.** When more than one investigator agent examines the same incident, their findings are merged into a single, reconciled result, and any disagreement between them is called out rather than hidden.
6. **Correlate related incidents.** A correlation agent checks whether separately investigated incidents actually share one underlying cause, and links them together when they do.
7. **Hand it to a human.** Every recommendation, along with the evidence behind it, lands in a docket for a human to review. The human can accept or reject the recommended action, and no action is ever taken without that approval.

---

## Sherlock AI Walkthrough

1. **AGV Yard Map**
   ![AGV Yard Map](gallery/AGV%20Yard%20Map.png)
   A real time view of every AGV's position and status across the Tuas yard, so an operator can see at a glance where an incident is happening.

2. **Unified Incident Timeline**
   ![Unified Incident Timeline](gallery/Unified%20Incident%20Timeline.png)
   A single timeline showing onsets, incidents, and alerts across the whole terminal, with a detail panel for whichever incident is selected.

3. **Incident Queue**
   ![Incident Queue](gallery/Incident%20Queue.png)
   The incidents Stage 1 clustering has produced from raw alerts, ready to be picked for investigation.

4. **View Real Time - Agent Reasoning**
   ![View Real Time - Agent Reasoning](gallery/View%20Real%20Time%20-%20Agent%20Reasoning%20.png)
   The live investigation view, streaming the currently active agent's reasoning and MCP tool calls as the pipeline runs.

5. **Completed Analysis**
   ![Completed Analysis](gallery/Completed%20Analysis.png)
   A finished investigation's docket, showing the root cause, the supporting evidence, and the recommended action.

6. **View Investigation Steps**
   ![View Investigation Steps](gallery/View%20Investigation%20Steps.png)
   The full trajectory the pipeline actually took for one incident: video analysis, orchestrator assignment, investigator findings, and correlation.

7. **CCTV Video Shown**
   ![CCTV Video Shown](gallery/CCTV%20Video%20Shown.png)
   An incident's linked CCTV clip surfaced in the docket as supporting evidence.

8. **CCTV Video Shown 2**
   ![CCTV Video Shown 2](gallery/CCTV%20Video%20Shown%202.png)
   A second example of CCTV footage used as evidence, for a different incident.

9. **Suggested Actions**
   ![Suggested Actions](gallery/Suggested%20Actions.png)
   The human in the loop panel, where PSA staff accept or reject the agent's recommended action.

---

## System Architecture Diagram

![System Architecture Diagram](gallery/System%20Architecture%20Diagram.png)

The full pipeline, top to bottom: `raw_alerts` feeds Stage 1's open clustering, which produces incidents for the Video Analyst Agent to review. The Orchestrator Agent then assigns one to three specialist investigator agents in parallel. Their findings are merged by the Aggregator, linked to related incidents by the Correlation Agent, and finally handed to a human to accept or reject.

---

## Tech Stack Used

| Category | Technology | Purpose |
|---|---|---|
| Orchestration | LangGraph | Orchestrator-Worker Agentic Workflow |
| Agent Tools | Model Context Protocol (MCP) | Unified MCP server exposing 9 read/write tools. |
| Reasoning | OpenAI (gpt-5.6-terra) | Drives the orchestrator, all 4 investigator agents, the aggregator, and the correlation agent. |
| Vision | Gemini (gemini-3.7-flash) | Independent CCTV read before routing, told only the incident's location and nothing else. |
| Data | Supabase | `raw_alerts`, telemetry, `videos`, and `incident_clusters_v2`, backed by live Postgres and object storage. |
| API / Streaming | FastAPI + Server-Sent Events | Streams every node's progress live to the frontend as the investigation runs. |
| Frontend | React + TypeScript | Live investigation view, incident queue, time ribbon, and the human accept/reject docket UI. |
| Observability | Langfuse | Every node, video analysis, orchestrator, each investigator, aggregator, correlation, traced separately. |

---

## Responsible & Transparent AI

Sherlock AI does not act as a black box. Every step an agent takes is shown, not just the final answer, so PSA staff can see how a conclusion was reached rather than being asked to simply trust it.

![View Real Time - Agent Reasoning](gallery/View%20Real%20Time%20-%20Agent%20Reasoning%20.png)

The live investigation view streams each agent's reasoning and every MCP tool call as it happens, and the "View Investigation Steps" trajectory keeps a full record afterward, from video analysis through to correlation.

A human is always in the loop. Every recommendation lands in a docket with its supporting evidence, and no action is ever executed on Sherlock AI's word alone. PSA staff review the evidence and either accept or reject the suggested action.

---

## Security

Every agent in the pipeline operates under the least privilege it needs, not full access. Each stage runs with a fixed role (investigator agents run as `LANE_OPERATIONS_ENGINEER`, docket submission runs as `SYSTEM_COORDINATOR`), and the MCP server checks that role against a permissions matrix before allowing any tool call. An investigator agent, for example, can never call the tool that submits a docket.

Every tool call, whether permitted or denied, is written to an audit log with the role, the tool, the parameters, the latency, and the outcome.

Sherlock AI also practices data minimization: the human-written diagnosis on a raw alert is never shown to any model. Agents only ever see machine-emitted signal, such as fault codes, timestamps, and locations, and a dedicated check enforces that the diagnosis field can never leak into a prompt.

Today, these roles are fixed per pipeline stage rather than tied to an authenticated PSA staff member. Adding real, login-backed role-based access control, so that different PSA staff roles see and approve different sets of incidents, is planned as future work.

---

## Future Plans

The chat input on the investigation view is currently disabled and marked "Coming Soon." The plan is to open it up so PSA staff can ask follow up questions once a diagnosis has landed, for example asking an investigator agent to check one more asset or explain a specific piece of evidence, without having to rerun the whole investigation.

That interface will ship with guardrails, not as an open ended chatbot. Questions will be scoped to the current incident's own evidence rather than free form prompting, any follow up action will still go through the same tool level RBAC enforcement described above, and the agent will be restricted to answering and citing evidence rather than taking or recommending new actions outside its investigator role. Input length limits and rate limiting will also be enforced to reduce the risk of prompt injection and misuse.

---

## 📁 Repository Structure

```text
├── backend/
│   ├── agent/                    # LangGraph multi-agent triage & investigation pipeline
│   │   ├── investigators/        # Specialized agent roles (lane, power, fleet_power)
│   │   │   ├── base.py           # Shared ReAct loop & prompt building
│   │   │   ├── lane.py           # Lane & corridor operations specialist
│   │   │   ├── power.py          # Battery charging station & power specialist
│   │   │   └── fleet_power.py    # Fleet-wide power correlation specialist
│   │   ├── coordinator.py        # Spawns investigator subgraphs based on incident clusters
│   │   ├── correlation.py        # Synthesizes cross-cluster root causes & timeline
│   │   ├── docket.py             # Prepares docket payloads & calls submit_incident_docket
│   │   ├── docket_shape.py       # Pydantic schemas & adapters for frontend contract
│   │   ├── graph.py              # Compiled LangGraph state graph with MCP tools
│   │   ├── mcp_tools.py          # Stdio FastMCP client & RBAC context binder
│   │   ├── run.py                # Standalone CLI entrypoint for graph execution
│   │   ├── server.py             # FastAPI backend (REST & SSE endpoints for live UI)
│   │   ├── stage1_bridge.py      # Loads Stage 1 clusters from Supabase or memory
│   │   ├── state.py              # LangGraph state definitions (OverallState)
│   │   └── tracing.py            # Langfuse observability & tracing integration
│   ├── clustering/               # Stage 1: Deterministic alert clustering & prioritization
│   │   ├── filter.py             # ST-DBSCAN + topology filter, deduplication, & scoring
│   │   ├── yard.py               # Yard spatial-topology graph (lanes, junctions, QC, BCSS)
│   │   └── adapter.py            # Data model adapters for alerts & telemetry
│   ├── mcp/                      # FastMCP server & security layer
│   │   ├── server.py             # Consolidated FastMCP server (telemetry, diagnostics, docket)
│   │   ├── telemetry_server.py   # Individual telemetry micro-server (reference)
│   │   ├── diagnostics_server.py # Individual diagnostics micro-server (reference)
│   │   ├── docket_server.py      # Individual docket micro-server (reference)
│   │   ├── security.py           # RBAC decorators & Supabase audit logging
│   │   ├── supabase_client.py    # Supabase connection & data access client
│   │   ├── test_mcp_servers.py   # FastMCP unit test suite
│   │   └── test_with_openai.py   # End-to-end agent verification script
│   ├── scripts/                  # Helper & experimental scripts (VLM video analysis)
│   ├── video/                    # Port CCTV footage samples
│   ├── test_clustering.py        # CLI test suite for Stage 1 clustering
│   ├── database_schema.md        # Database schema specifications
│   └── requirements.txt          # Python backend dependencies
├── frontend/
│   ├── src/                      # React application source code
│   │   ├── components/           # UI components (Alerts, Clusters, Copilot, Spawning)
│   │   └── App.tsx               # Main application component
│   ├── package.json              # Node dependencies and scripts
│   └── vite.config.ts            # Vite configuration
├── DESIGN.md                     # Frontend UX/UI and design specifications
└── overall.md                    # Project architecture and system overview
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0+ and **npm** (for Frontend)
- **Python**: v3.10+ (for Backend)
- **Supabase Account / Project**: PostgreSQL database configured with required schemas
- **OpenAI API Key** (required for LangGraph multi-agent LLM investigations)
- **Langfuse API Keys** (optional, for LLM tracing & observability)

---

## ⚙️ Running the Backend

The backend provides:
1. **Deterministic ST-DBSCAN + Yard Topology Clustering** (Stage 1) to group raw terminal alerts into structured incident clusters.
2. **Unified FastMCP Server** exposing all telemetry, diagnostics, and docket publishing tools with Role-Based Access Control (RBAC) and Supabase audit logging.
3. **LangGraph Multi-Agent Investigation Pipeline & FastAPI Server** (Stage 2) with streaming SSE endpoints for the frontend visualizer.

### 1. Navigate to the Backend directory
```bash
cd backend
```

### 2. Set up Python Virtual Environment

#### On Windows:
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

#### On macOS / Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Create or verify `.env` in the `backend/` directory:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_or_anon_key
OPENAI_API_KEY=your_openai_api_key

# Optional: Langfuse tracing
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_SECRET_KEY=your_langfuse_secret_key
LANGFUSE_HOST=https://cloud.langfuse.com
```

### 5. Running the Backend Services

#### Option A: Start the FastAPI LangGraph Server (Recommended for Frontend)
Starts the REST and Server-Sent Events (SSE) investigation API (automatically connects to the unified FastMCP server):
```bash
uvicorn agent.server:app --reload --port 8000
```
- **Health Check**: `GET http://localhost:8000/api/health`
- **Run Investigation**: `POST http://localhost:8000/api/investigate`
- **Live Agent Spawning Stream**: `GET http://localhost:8000/api/investigate/stream?cluster_id=CLUSTER-A`

#### Option B: Run the LangGraph Multi-Agent CLI
Run an end-to-end investigation run from the command line:
```bash
python -m agent.run
```

#### Option C: Test Stage 1 Alert Clustering
Run deterministic ST-DBSCAN + Yard Topology clustering on live Supabase alerts or curated test streams:
```bash
# Read live alerts from Supabase
python test_clustering.py --source supabase

# Run with noise filtering enabled
python test_clustering.py --source supabase --filter-noise

# Run against curated PSA sprint scenarios
python test_clustering.py --source curated
```

#### Option D: Run FastMCP Server & Tests
```bash
# Start the unified FastMCP server over stdio (all tools in one process):
python mcp/server.py

# Run MCP unit test suite:
python mcp/test_mcp_servers.py

# Run OpenAI agent tool calling test:
python mcp/test_with_openai.py
```

---

## 🖥️ Running the Frontend

The frontend is a Vite + React + TypeScript + Tailwind CSS application providing the PSA Terminal Incident Alerts & Agent Spawning Console.

### 1. Navigate to the Frontend directory
```bash
cd frontend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables (Optional)
If connecting directly to Supabase from the client, create or update `.env` in `frontend/`:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Start the Development Server
```bash
npm run dev
```

The application will be accessible at:
👉 **`http://localhost:5173`** (or the port shown in your terminal).

### Other Available Scripts (Frontend)
- `npm run build` — Type-check and compile production bundle
- `npm run preview` — Locally preview the production build

---

## 🛠️ Architecture & Documentation Links
- [DESIGN.md](DESIGN.md) — Front-end UI/UX, incident triage workflow, and spawning visualizer design.
- [overall.md](overall.md) — Multi-agent system architecture and SCADA pipeline.
- [backend/database_schema.md](backend/database_schema.md) — Supabase database schema and table definitions.
- [backend/mcp/mcp_setup_and_supabase_mapping.md](backend/mcp/mcp_setup_and_supabase_mapping.md) — Complete MCP protocol and Supabase mapping reference.
- [backend/mcp/mcp_build_instructions.md](backend/mcp/mcp_build_instructions.md) — FastMCP server construction and security instructions.