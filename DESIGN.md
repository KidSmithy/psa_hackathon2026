# PSA Terminal Incident Review Docket & Copilot — Front-End Design System (DESIGN.md)

## 1. Executive Summary & Design Philosophy

The **PSA Terminal Incident Review Docket & Copilot** is an industrial-grade, AI-assisted operations console designed for 24/7 automated container terminal operations (Tuas Port). 

During high-velocity operational anomalies across automated guided vehicles (AGVs), quay cranes (QCs), and battery charging/swapping stations (BCSS), traditional SCADA alarm floods overwhelm human operators. This interface solves that cognitive overload by combining:

1. **A Clean, Distraction-Free Human Review Docket:** A crisp, high-contrast operational console presenting verified root causes, SCADA hardware evidence, decoded PLC registers, and 1-click dispatch actions.
2. **A Conversational Multi-Agent Copilot:** An interactive, conversational AI chat interface that visually demonstrates the real-time **Stage 1 (Noise Filter) $\rightarrow$ Stage 2 (Coordinator & Isolated Sub-Agent Spawning) $\rightarrow$ Stage 3 (MCP SCADA Telemetry) $\rightarrow$ Stage 4 (Synthesized Docket)** sequence directly in the chat stream when prompted by the operator.

### Core UI/UX Principles
- **Clean Light Theme Default:** Crisp white (`#FFFFFF`) cards and soft slate (`#F8FAFC`) backgrounds engineered for clarity, readability, and low eye strain.
- **Conversational Spawning Animation:** Rather than opening a complex or rigid board, agent spawning is demonstrated conversationally with animated sandbox pods, token budget meters, and live MCP tool execution tags.
- **Verifiable Hardware Proof:** Every AI conclusion is supported by certified sensor timestamps, mechanical pressure readings, and decoded PLC hexadecimal fault registers.
- **Zero-Pollution Transparency:** Visual feedback proving sub-agent memory and token boundaries remain $100\%$ strictly isolated ($0\%$ cross-contamination).

---

## 2. Interactive Architecture & User Flow

```
+---------------------------------------------------------------------------------------------+
|                             SCREEN 1: HUMAN REVIEW DOCKET CONSOLE                           |
|  - Cluster Selector Tabs: [ Cluster A (CRITICAL) ]  [ Cluster B (HIGH) ]  [ Cluster C ]     |
|  - Causal Chain & Verified Root Cause Summary                                               |
|  - Multimodal SCADA Hardware Evidence Checklist                                             |
|  - Decoded PLC Fault Registers Table (0x7E1 / 0x9B4)                                        |
|  - Action Dispatch Center: [ 🚀 1-Click Authorize & Execute Action ]                         |
+---------------------------------------------------------------------------------------------+
                                       │
                    Click "[ ⚡ Test Agent Spawning ]"
                                       │
                                       ▼
+---------------------------------------------------------------------------------------------+
|                             SCREEN 2: COPILOT CHAT INTERFACE                                |
|  - Operator types query (e.g. "Investigate Lane 7 bottleneck") and presses Enter            |
+---------------------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------------------+
|  STEP 1: COORDINATOR ASSESSMENT (Chat Message)                                              |
|  "🤖 Ingested 142 field alerts -> 116 baseline noise dropped (81.7% zero-token savings).    |
|   Coordinator evaluated topology -> Spawning dedicated investigator sub-agent."             |
+---------------------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------------------+
|  STEP 2: LIVE SUB-AGENT SPAWNING SANDBOX CARD (Inline Animated Card)                        |
|  - ⚡ Agent 1 (Lane Investigator) instantiated with exclusive PID 8841                      |
|  - 🔒 Context Isolation Sandbox Active (0% Cross-Contamination Guarantee)                   |
|  - 📊 Token Budget Meter: 1,140 / 2,000 tokens (57%)                                         |
|  - ⚙️ Active MCP Tool Call: mcp-terminal-telemetry::get_lane_queue_order(Lane-07)            |
|  - 📑 Expandable Diagnostic Schema Logs (decoded PLC 0x7E1 ERR_TWISTLOCK_TIMEOUT)           |
+---------------------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------------------+
|  STEP 3: CONSOLIDATED HUMAN REVIEW DOCKET CARD IN CHAT                                      |
|  - 🚨 CRITICAL SEVERITY: Quay Crane QC-03 Starvation on Berth 2                             |
|  - 🔍 Verified Root Cause: Mechanical twistlock pin jam on AGV-104 @ 275 bar relief         |
|  - ✅ SCADA Certified Hardware Evidence Checklist                                           |
|  - 🚀 One-Click Action: [ Authorize Mobile Mechanical Override on AGV-104 ]                 |
+---------------------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------------------+
|  STEP 4: DISPATCH CONFIRMATION MESSAGE                                                      |
|  "✅ Action WO-88219 authorized. Field mechanical crew dispatched (ETA: 3m 30s)."            |
|                                                                                             |
|  [ Click "← Back to Review Docket" in header to return anytime ]                            |
+---------------------------------------------------------------------------------------------+
```

---

## 3. Design Tokens & Color Palette (Pure Light Theme)

| Token / Role | Value Name | Hex Code | Tailwind Token | Semantic Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Canvas Background** | Slate Clean Base | `#F8FAFC` | `bg-slate-50` | Global application viewport background |
| **Card / Surface** | Pure Crisp White | `#FFFFFF` | `bg-white` | Main containers, chat bubbles, dossier cards |
| **Surface Accent** | Slate Muted | `#F1F5F9` | `bg-slate-100` | Inner cards, table headers, inactive tabs |
| **Border / Divider** | Crisp Mesh Border | `#E2E8F0` | `border-slate-200` | 1px clean separators and subtle gridlines |
| **Primary Brand / Action**| Ocean Sky | `#0284C7` | `text-sky-600`, `bg-sky-600` | Active tabs, send button, action dispatch |
| **Primary Brand Hover**| Ocean Sky Glow | `#0EA5E9` | `hover:bg-sky-700` | Interactive hover states |
| **Critical Severity** | Coral Red | `#DC2626` | `text-red-600`, `bg-red-50` | Jammed twistlocks, QC starvation, breaker trips |
| **Caution / Warning** | Industrial Amber | `#D97706` | `text-amber-800`, `bg-amber-50` | High severity, thermal cutoff, headway holds |
| **Verified Telemetry**| Emerald Green | `#059669` | `text-emerald-700`, `bg-emerald-50` | Verified evidence checkmarks, 0% contamination |
| **Primary Text** | Deep Navy Slate | `#0F172A` | `text-slate-900` | Headings, critical metrics, message text |
| **Secondary Text** | Slate Muted | `#64748B` | `text-slate-500` | Timestamps, units, tool parameters |

---

## 4. Component Hierarchy & Module Breakdown

### 4.1 Global Header (`Header.tsx`)
- **Brand Identity:** PSA Mission Control & AI Incident Review Docket.
- **View Mode Switcher:**
  - In Review Docket view: displays **`[ ⚡ Test Agent Spawning ]`** button.
  - In Chat Copilot view: displays **`[ ← Back to Review Docket ]`** button.
- **KPI Metrics:**
  - `Zero-Token Savings`: Percentage of noise alarms filtered without LLM invocation ($81.7\%$).
  - `Pending Action`: Active incident clusters requiring supervisor authorization.
  - `50Hz SCADA`: Live telemetry message queue heartbeat.
- **Export Action:** 1-click **Export / Print Docket** functionality.

### 4.2 Primary Screen: Human Review Docket Console (`HumanDocketPage.tsx`)
- **Cluster Selector Ribbon:** Switch between **Cluster A** (Lane 7 Bottleneck), **Cluster B** (BCSS-02 Thermal Trip), and **Cluster C** (Energy Starvation Risk).
- **Incident Summary Card:** Displays incident title, severity classification, and operational downstream impact (e.g. *Quay Crane QC-03 Starvation / Vessel Berth 2 Stalled*).
- **AI Triage Verified Root Cause Card:** Clear causal chain explanation with a quick **"Test Agent Spawning in Chat"** button.
- **Multimodal Hardware Evidence Proof:** SCADA-certified timestamps and sensor validations.
- **Decoded PLC Registers Table:** Hexadecimal registers decoded into human-readable descriptions (`0x7E1` $\rightarrow$ `ERR_TWISTLOCK_TIMEOUT`, `0x9B4` $\rightarrow$ `OVERTEMP_THERMAL_CUTOFF`).
- **Action Dispatch Center:** Interactive authorization buttons updating in real time to `DISPATCHED TO FIELD TERMINAL`.

### 4.3 Interactive Screen: Copilot Chat Interface (`ChatInterface.tsx`)
- **Conversational Stream:** Natural dialogue between operator and PSA AI Copilot.
- **Step-by-Step Spawning Simulation:**
  - Typing any query (or clicking quick prompt chips) triggers the 4-step triage sequence.
  - Renders inline **Sub-Agent Isolation Sandbox Cards** with real-time token budget progress bars (`1,140 / 2,000 tokens`).
  - Expandable diagnostic schema logs and live MCP tool execution tags.
- **Inline Docket Delivery:** Delivers the synthesized docket directly in the chat with operational authorization buttons.
- **Quick Prompt Chips:** One-click shortcuts for `🔍 Lane 7 Jam (Cluster A)`, `⚡ BCSS-02 Charger Trip (Cluster B)`, and `⚡ Full Spawning Demo`.

---

## 5. Directory Structure

```
frontend/
├── src/
│   ├── pages/
│   │   └── HumanDocketPage.tsx       # Primary Human Review Docket & Dispatch console
│   ├── components/
│   │   ├── ChatInterface.tsx         # Clean Copilot Chat with conversational agent spawning
│   │   └── Header.tsx                # Top navigation & system status bar
│   ├── data/
│   │   └── mockData.ts               # Dataset for Clusters A, B, C matching overall.md
│   ├── types/
│   │   └── index.ts                  # Typed TypeScript interfaces
│   ├── App.tsx                       # State manager switching between Docket and Chat
│   ├── index.css                     # Custom scrollbars & light styling
│   └── main.tsx                      # React mount entry point
├── tailwind.config.js                # Design tokens & color config
├── vite.config.ts                    # Vite build configuration
└── package.json
```

---

## 6. Live Backend Integration Guide

To connect the front-end to live SCADA brokers and LLM orchestration servers:
- **WebSocket Endpoint `/ws/telemetry`:** Ingest live 50Hz AGV kinematics and hydraulic pressure sensors into `TerminalTelemetryPoint`.
- **Server-Sent Events (SSE) `/api/events/triage`:** Stream real-time sub-agent spawning events and tool executions into `ChatInterface.tsx`.
- **REST Endpoint `POST /api/docket/:id/dispatch`:** Authorize field work orders and dispatch mobile mechanical technicians.

---

## 7. Hackathon Demo Walkthrough Script

1. **Step 1: Open the Review Docket Console**
   - Highlight the clean, pure light-theme layout designed for terminal supervisors.
   - Switch between **Cluster A** and **Cluster B** to showcase verified root cause synthesis and decoded PLC registers (`0x7E1`).
2. **Step 2: Trigger Agent Spawning in Chat**
   - Click **`[ ⚡ Test Agent Spawning ]`** in the header.
   - Explain how the AI Copilot provides a conversational, uncluttered experience.
3. **Step 3: Watch the Spawning & Context Isolation Animation**
   - Type *"Investigate Lane 7 bottleneck"* and press **Enter**.
   - Point out:
     - **Stage 1:** Ingesting 142 alerts $\rightarrow$ 116 baseline noise dropped ($81.7\%$ token savings).
     - **Stage 2:** Spawning **Agent 1 (Lane Investigator)** in an isolated sandbox ($0\%$ cross-contamination) with dedicated token budget meter ($1,140 / 2,000$ tokens).
     - **Stage 3:** MCP queries to SCADA telemetry and PLC registers.
     - **Stage 4:** The Synthesized Human Review Docket card generated in chat.
4. **Step 4: Authorize Field Dispatch**
   - Click **`[ Authorize Mobile Mechanical Override on AGV-104 ]`**.
   - Show the real-time work order generation (`WO-88219`) and field tracking ETA (`3m 30s`).
5. **Step 5: Return to Docket Console**
   - Click **`[ ← Back to Review Docket ]`** to return seamlessly to the main console.
