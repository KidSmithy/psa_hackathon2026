# PSA Terminal Incident Alerts & Agent Spawning Console — Front-End Design System (DESIGN.md)

## 1. Executive Overview

The frontend is a **clean, minimalist, single-column operational interface** built for PSA Tuas Port terminal operators and supervisors.

The interface is structured around an uncluttered 2-view workflow:

1. **Primary Screen — Alerts & Clusters Console (`AlertsClustersPage.tsx`):**
   - **1 Card Per Row Layout:** Instead of cramped side-by-side grids, each incident cluster spans a full-width horizontal row card.
   - **Minimalist Aesthetics:** High-clarity typography, soft slate background (`#F8FAFC`), crisp 1px borders, subtle severity dots, and reduced visual clutter.
   - **Live Supabase Data:** Directly queries the Supabase PostgreSQL database tables (`incident_clusters` and `raw_alerts`).
   - **Inline Expandable Alerts Drawer:** Users can preview top alarm highlights or toggle `[ View N Alerts ▾ ]` to inspect correlated telemetry without leaving the page.
   - **Prominent Action Button:** Every row features a sharp, focused **`[ ⚡ RESOLVE INCIDENT → ]`** button.

2. **Secondary Screen — Agent Spawning & Resolution Console (`AgentSpawningPage.tsx`):**
   - Triggered immediately upon clicking **`[ ⚡ Resolve Incident ]`** on any cluster.
   - Live animated 4-stage multi-agent spawning:
     - **Stage 1:** Topological Coordinator assessment & spatial-temporal noise filtering ($81.7\%$ token reduction).
     - **Stage 2:** Sub-Agent Instantiation in an isolated sandbox pod with laser particle conduits, PID (`8841`), $0\%$ Cross-Contamination guarantee, and context token budget meter (`1,140 / 2,000 tokens`).
     - **Stage 3:** Real-time MCP tool executions (`mcp-terminal-telemetry::get_lane_queue_order` and `mcp-terminal-diagnostics::decode_plc_fault_code 0x7E1`).
     - **Stage 4:** Consolidated Human Review Docket with verified physical sensor evidence and 1-click **`[ 🚀 Authorize Field Action & Resolve ]`** button.
   - Top **`[ ← Back to Alerts & Clusters ]`** button to return at any time.

---

## 2. Layout Structure & Interaction Flow (1 Card Per Row)

```
+-------------------------------------------------------------------------------------------------------------+
|                                    PSA TUAS INCIDENT DISPATCH CONSOLE                                       |
|  Total Alerts: 31  •  Active Clusters: 6  •  Critical: 4  •  High: 10  •  Supabase: Connected  •  50Hz SCADA |
+-------------------------------------------------------------------------------------------------------------+
| [ Incident Clusters (6) ] [ All Raw Alerts (31) ]    [ Severity Filter ▾ ] [ Sector Filter ▾ ] [ Search... ]|
+-------------------------------------------------------------------------------------------------------------+
|                                                                                                             |
|  ROW 1 (Full Width):                                                                                        |
|  [● CRITICAL] CLUSTER-A  Transfer Lane 7 Bottleneck & Twistlock Jam           [ View 8 Alerts ▾ ]           |
|  Location: Lane_7 • Agent: Agent_1_LaneInvestigator • 8 alerts                [ ⚡ RESOLVE INCIDENT → ]     |
|  Telemetry Preview: ALRT-1091 Spreader release timeout • ALRT-1094 Hydraulic pressure 275 bar               |
|                                                                                                             |
+-------------------------------------------------------------------------------------------------------------+
|                                                                                                             |
|  ROW 2 (Full Width):                                                                                        |
|  [● HIGH] CLUSTER-B  BCSS-02 Fast-Charger High-Voltage Trip                   [ View 7 Alerts ▾ ]           |
|  Location: Station_BCSS_02 • Agent: Agent_2_BCSSInvestigator • 7 alerts       [ ⚡ RESOLVE INCIDENT → ]     |
|  Telemetry Preview: ALRT-2011 Breaker tripped • ALRT-2014 Busbar temp 82.4°C > 80°C threshold               |
|                                                                                                             |
+-------------------------------------------------------------------------------------------------------------+
|                                                                                                             |
|  ROW 3 (Full Width):                                                                                        |
|  [● HIGH] CLUSTER-C  Sector A Battery Starvation Cascading Deficit            [ View 4 Alerts ▾ ]           |
|  Location: Sector_A • Agent: Agent_3_FleetPowerInvestigator • 4 alerts        [ ⚡ RESOLVE INCIDENT → ]     |
|  Telemetry Preview: ALT-016 AGV-088 SoC 11.8% • ALT-017 BCSS-01 at 100% capacity                            |
|                                                                                                             |
+-------------------------------------------------------------------------------------------------------------+
                                                       │
                                     Click "Resolve Incident"
                                                       │
                                                       ▼
+-------------------------------------------------------------------------------------------------------------+
|                                      AGENT SPAWNING & RESOLUTION PAGE                                       |
|  [ ← Back to Alerts & Clusters ]  •  CLUSTER-A: Lane 7 Bottleneck  •  [ 🔄 Replay Spawn ]  [ ▶️ Live Pulse ] |
|                                                                                                             |
|  [ STAGE 1 & 2: COORDINATOR & ISOLATED SUB-AGENT SANDBOX POD ]                                              |
|    • Coordinator evaluates Berth 2 / Sector A layout • 81.7% noise dropped                                  |
|    • Agent_1_LaneInvestigator (PID 8841) • 0% Cross-Contamination • Budget: 1,140 / 2,000 tok (57%)         |
|    • Executing MCP: get_lane_queue_order(Lane-07) & decode_plc_fault_code(0x7E1)                            |
|                                                                                                             |
|  [ STAGE 3 & 4: SYNTHESIZED HUMAN REVIEW DOCKET & ACTION AUTHORIZATION ]                                    |
|    • Verified Root Cause: Mechanical twistlock jam on AGV-104 @ 275 bar relief pressure                     |
|    • Multimodal Hardware Evidence Checklist (SCADA certified)                                               |
|    • [ 🚀 AUTHORIZE FIELD ACTION: DISPATCH MOBILE MECHANICAL TEAM TO AGV-104 (LANE 7) ]                     |
+-------------------------------------------------------------------------------------------------------------+
```

---

## 3. Design Tokens & Palette (PSA Tuas Cyber-Maritime 2040 Light Theme)

| Token / Role | Value Name | Hex Code | Tailwind Token | Semantic Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Top Command Bar** | PSA Navy Deep | `#002B49` | `bg-psa-navy text-white` | Header branding & institutional grounding |
| **Canvas Background**| Anti-Glare Maritime Canvas | `#F0F4FA` | `bg-psa-canvas` | Global viewport background with SCADA micro-grid |
| **Card / Row Surface**| Pure Crisp Surface | `#FFFFFF` | `bg-white` | Incident row cards & multi-agent pods |
| **Border / Divider** | Precision Port Border | `#D5E2EE` | `border-psa-border` | 1px clean crisp separators |
| **Autonomous Electric**| Electric Tuas Teal | `#00C9A7` | `text-tuas-teal`, `bg-tuas-teal` | Multi-agent sandbox pods, AGV routes, conduits |
| **Laser SCADA Signal**| Tuas Cyan / Sky Blue | `#00B4D8` / `#0284C7` | `text-tuas-cyan`, `bg-tuas-cyan` | MCP tool execution items, active tabs |
| **PSA Flame Alarm** | PSA Signature Flame Red | `#E63946` | `text-psa-flame`, `bg-psa-flame-bg`| Critical severity tags, twistlock jam alerts |
| **Caution / High** | Industrial Amber | `#D97706` | `text-amber-800`, `bg-amber-50` | Thermal limits, busbar warnings |
| **Nominal / Verified**| Smart Port Emerald | `#059669` | `text-nominal-emerald`, `bg-nominal-emerald-bg` | Verified evidence checkmarks, 0% contamination |
| **Primary Typography**| Deep Quantum Navy Ink | `#0B1E36` | `text-psa-navy-dark` | Headings & high-precision telemetry metrics |
| **Subtle Telemetry** | Tactical Muted Slate | `#5A6E85` | `text-psa-muted` | Timestamps, coordinates, MCP parameters |

---

## 4. File Structure

```
frontend/
├── src/
│   ├── pages/
│   │   ├── AlertsClustersPage.tsx    # Minimalist 1-card-per-row Alerts & Clusters console
│   │   └── AgentSpawningPage.tsx     # Dynamic multi-agent spawning & resolution console
│   ├── components/
│   │   └── Header.tsx                # Clean top header with Supabase status & active stats
│   ├── lib/
│   │   └── supabase.ts               # Supabase JS client configuration
│   ├── data/
│   │   └── supabaseMockFallback.ts   # Seeded fallback matching Supabase PostgreSQL tables
│   ├── types/
│   │   └── index.ts                  # Typed interfaces matching Supabase tables
│   ├── App.tsx                       # Main application entry with live Supabase query state
│   ├── index.css                     # Custom styling & light theme directives
│   └── main.tsx                      # React mount entry point
├── tailwind.config.js
├── vite.config.ts
└── package.json
```
