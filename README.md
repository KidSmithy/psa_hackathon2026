# PSA Hackathon 2026 - Automated Port Terminal Incident Investigation Platform

This repository contains the full-stack system for the PSA Automated Port Terminal Incident Investigation platform, featuring real-time SCADA telemetry correlation, FastMCP micro-servers, Supabase integration, and a React-based operator console with agent spawning visualization.

---

## 📁 Repository Structure

```text
├── backend/
│   ├── agents/                   # Multi-agent investigation orchestration
│   ├── mcp/                      # FastMCP micro-servers (telemetry, diagnostics, docket)
│   │   ├── telemetry_server.py   # SCADA telemetry & queue status micro-server
│   │   ├── diagnostics_server.py # PLC fault code & maintenance records micro-server
│   │   ├── docket_server.py      # Incident review docket publishing micro-server
│   │   ├── security.py           # RBAC decorators & Supabase audit logging
│   │   ├── supabase_client.py    # Supabase connection & data access client
│   │   ├── test_mcp_servers.py   # FastMCP unit test suite
│   │   └── test_with_openai.py   # End-to-end agent verification script
│   ├── database_schema.md        # Database schema specifications
│   └── requirements.txt          # Python dependencies
├── frontend/
│   ├── src/                      # React application source code
│   │   ├── components/           # UI components (Alerts, Clusters, Copilot)
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
- **OpenAI API Key** (optional, required for autonomous agent tests)

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
If connecting directly to Supabase from the client, create or update `.env` in the `frontend/` root:
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

## ⚙️ Running the Backend

The backend provides FastMCP micro-servers for telemetry SCADA ingestion, diagnostics, and docket publishing with Role-Based Access Control (RBAC) and Supabase audit logging.

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
Create a `.env` file in the `backend/` directory (or verify `backend/.env`):
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_or_anon_key
OPENAI_API_KEY=your_openai_api_key
```

### 5. Running MCP Micro-Servers & Tests

#### Start an MCP Server over `stdio`:
```bash
# Start the Telemetry FastMCP server:
python mcp/telemetry_server.py

# Start the Diagnostics FastMCP server:
python mcp/diagnostics_server.py

# Start the Docket Publishing FastMCP server:
python mcp/docket_server.py
```

#### Run Automated Test Suites:
```bash
# Run unit tests (RBAC validation & Supabase integration):
python mcp/test_mcp_servers.py

# Run Autonomous End-to-End LLM Agent test:
python mcp/test_with_openai.py
```

---

## 🛠️ Architecture & Documentation Links
- [DESIGN.md](DESIGN.md) — Front-end UI/UX, incident triage workflow, and spawning visualizer design.
- [overall.md](overall.md) — Multi-agent system architecture and SCADA pipeline.
- [backend/database_schema.md](backend/database_schema.md) — Supabase database schema and table definitions.
- [backend/mcp/mcp_setup_and_supabase_mapping.md](backend/mcp/mcp_setup_and_supabase_mapping.md) — Complete MCP protocol and Supabase mapping reference.