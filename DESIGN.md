# PSA Terminal Incident Alerts & Agent Spawning Console — Front-End Design System (DESIGN.md)

## 1. Executive Overview

The frontend is a **clean, minimalist, single-column operational interface** built for PSA Tuas Port terminal operators and supervisors.

The interface is structured around a streamlined 2-view workflow:

1. **Primary Screen — Alerts & Clusters Console (`AlertsClustersPage.tsx`):**
   - **1 Card Per Row Layout:** Clean, full-width horizontal row cards for each incident cluster with high-clarity typography and soft slate styling (`#F8FAFC`).
   - **Direct Supabase Integration:** Queries live PostgreSQL tables `incident_clusters` and `raw_alerts`.
   - **Inline Expandable Alerts Drawer:** Inspect correlated raw telemetry alerts (`[ View N Alerts ▾ ]`).
   - **Action Trigger:** Every row features a prominent **`[ ⚡ RESOLVE INCIDENT → ]`** button.

2. **Secondary Screen — PSA INCIDENT COPILOT / Spawning Visualizer (`ChatInterface.tsx`):**
   - Triggered immediately upon clicking **`[ ⚡ RESOLVE INCIDENT → ]`** on any cluster card.
   - Top Header with `[ ← Back to Docket / Alerts ]`, `PSA INCIDENT COPILOT [SPAWNING VISUALIZER]`, `[ ⚡ Trigger Spawn Demo ]`, and Reset controls.
   - **Multi-Agent Spawning Sequence:**
     - **Stage 1:** Coordinator ingests SCADA bus and executes spatial-temporal noise reduction ($81.7\%$ token reduction).
     - **Stage 2:** Sub-Agent Instantiated in an **Isolated Sandbox Pod** (PID `8841`), $0\%$ Cross-Contamination guarantee, active token budget meter (`1,140 / 2,000 tok`), and active MCP query executions (`mcp-terminal-telemetry::get_lane_queue_order(Lane-07)`).
     - **Stage 3 & 4:** Synthesized Human Review Docket with AI-verified root cause, multimodal hardware evidence checklist, and 1-click **`[ 🚀 Authorize Action Dispatch ]`** button.
   - **Quick Spawning Triggers:** `[ 🔍 Lane 7 Jam (Cluster A) ]`, `[ ⚡ BCSS-02 Charger Trip (Cluster B) ]`, `[ ⚡ Full Spawning Demo ]`.
   - **Interactive Chat Input:** Type any query (e.g., *"Investigate Lane 7"* or *"Simulate agent spawning"*) and press **Enter** to trigger the triage animation.

---

## 2. Interaction Flow

```
+-------------------------------------------------------------------------------------------------------------+
|                                    PSA TUAS INCIDENT DISPATCH CONSOLE                                       |
|  Total Alerts: 31  •  Active Clusters: 6  •  Critical: 4  •  High: 10  •  Supabase: Connected  •  50Hz SCADA |
+-------------------------------------------------------------------------------------------------------------+
|                                                                                                             |
|  CLUSTER ROW #1:                                                                                            |
|  [● CRITICAL] CLUSTER-A  Lane 7 Bottleneck & Twistlock Jam                    [ View 8 Alerts ▾ ]           |
|  Location: Lane_7 • Agent: Agent_1_LaneInvestigator                           [ ⚡ RESOLVE INCIDENT → ] ──┐ |
|                                                                                                          │ |
+----------------------------------------------------------------------------------------------------------│--+
                                                                                                           │
                                                       Click "Resolve Incident"                            │
                                                                                                           ▼
+-------------------------------------------------------------------------------------------------------------+
|                                      PSA INCIDENT COPILOT [SPAWNING VISUALIZER]                             |
|  [ ← Back to Docket ]  •  Type any query below to trigger multi-agent spawning  •  [ ⚡ Trigger Spawn Demo ] |
|                                                                                                             |
|  [ BOT MESSAGE ]                                                                                            |
|  👋 Welcome to PSA Incident Copilot. Live SCADA stream synchronized at 50Hz.                                |
|                                                                                                             |
|  [ SUB-AGENT ISOLATED SANDBOX POD ]                                                                         |
|  • Agent_1_LaneInvestigator (PID: 8841) • 0% CONTAMINATION                                                  |
|  • Token Budget: 1,140 / 2,000 tokens (57%)                                                                 |
|  • Active MCP Tool Call: mcp-terminal-telemetry::get_lane_queue_order(Lane-07)                               |
|                                                                                                             |
|  [ SYNTHESIZED HUMAN REVIEW DOCKET ]                                                                        |
|  • Root Cause: Twistlock pin jam on AGV-104 @ 275 bar relief valve pressure                                  |
|  • Multimodal Hardware Evidence Checklist                                                                   |
|  • [ AUTHORIZE: Dispatch mobile mechanical crew to Lane 7 for manual twistlock override ]                   |
|                                                                                                             |
|  QUICK TRIGGERS: [ 🔍 Lane 7 Jam (Cluster A) ]  [ ⚡ BCSS-02 Charger Trip (Cluster B) ]  [ ⚡ Full Demo ]     |
|  [ Type any message (e.g. 'Investigate Lane 7') and press Enter...                                     ➤ ] |
+-------------------------------------------------------------------------------------------------------------+
```
