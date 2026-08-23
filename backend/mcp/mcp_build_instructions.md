# Implementation Specification: Port Terminal Incident Investigation MCP Servers

## Context & System Overview

We are building a prototype multi-agent root cause analysis system for an automated port terminal. The pipeline operates in 3 distinct stages:

- **Stage 1 (Deterministic Filter):** Simulates ST-DBSCAN + spatial topology filtering using a hardcoded mock mapping to collapse raw alert streams (15 incoming alerts) into 2 discrete incident clusters.
- **Stage 2 (Coordinator Delegation):** Spawns dedicated LLM investigator agents per cluster (Agent 1 for Lane 7 Bottleneck, Agent 2 for BCSS Charger Trip).
- **Stage 3 (Telemetry & Diagnostic Evidence Gathering):** Investigator agents query domain-specific MCP tools to fetch time-series telemetry and hardware diagnostic data, identify root causes, and publish a unified human review docket.

---

## CRITICAL MANDATE: MCP TOOL OUTPUT FORMAT

> **BIG NOTE ON TOOL OUTPUTS:**
>
> All MCP tools MUST return data in structured JSON format (standard Python `dict` or `list` objects that serialize cleanly to JSON).
>
> Do NOT return plain unformatted text strings, prose explanations, or markdown logs from the MCP tools. LLM agents rely on rigid, programmatically parseable JSON payloads to extract metrics, statuses, and sensor readings for downstream reasoning.

---

## 1. Environment & Architecture Specifications

- **Language:** Python 3.11+ (recommended for optimal FastMCP performance)
- **Framework:** `mcp` SDK or `fastmcp` (`pip install mcp fastmcp`)
- **Transport:** `stdio` (Standard Input/Output) or `SSE` (Server-Sent Events)
- **Design Pattern:** Decoupled, single-responsibility micro-servers returning structured JSON.

### Target Server Files to Create

| File | Server Name |
|------|-------------|
| `telemetry_server.py` | `mcp-terminal-telemetry` |
| `docket_server.py` | `mcp-docket-service` |

---

## 2. Server & Tool Specifications

### Server 1: `mcp-terminal-telemetry`

Provides time-series, operational, and diagnostic telemetry from Fleet Management Systems (FMS), AGVs, and Charging Stations (BCSS).

#### Tool 1.1: `get_lane_lead_agv`

**Description:** Queries spatial queue data for a given transport lane to identify the blocking/lead AGV at the head of the line.

**Input Parameters:**

- `lane_id` (`string`): Unique identifier for the lane (e.g., `"Lane_7"`).

**Return Schema (JSON Object):**

```json
{
  "lane_id": "string",
  "lead_agv_id": "string",
  "blocked_vehicles": ["string"],
  "status": "BLOCKED | CLEAR"
}
```

---

#### Tool 1.2: `get_agv_telemetry`

**Description:** Retrieves real-time sensor metrics, hydraulic state, motor currents, and error register flags for a specific AGV.

**Input Parameters:**

- `agv_id` (`string`): Vehicle ID (e.g., `"AGV-104"`).

**Return Schema (JSON Object):**

```json
{
  "agv_id": "string",
  "speed_mps": 0.0,
  "twistlock_sensor": "ENGAGED | DISENGAGED | FAULT",
  "twistlock_command": "RELEASE | LOCK | IDLE",
  "hydraulic_pressure_bar": 0.0,
  "error_register": "ERR_TWISTLOCK_TIMEOUT | NONE"
}
```

---

#### Tool 1.3: `get_bcss_charger_status`

**Description:** Queries electrical and thermal telemetry for a Battery Change/Charging Station (BCSS).

**Input Parameters:**

- `station_id` (`string`): Station ID (e.g., `"BCSS-02"`).

**Return Schema (JSON Object):**

```json
{
  "station_id": "string",
  "breaker_state": "TRIPPED | NORMAL",
  "bus_temperature_c": 0.0,
  "voltage_v": 0.0,
  "trip_reason": "OVERTEMP_THERMAL_CUTOFF | NONE"
}
```

---

### Server 2: `mcp-docket-service`

Receives final synthesized findings from investigator agents and commits them to the Human Review Docket queue.

#### Tool 2.1: `submit_incident_docket`

**Description:** Compiles synthesized incident analyses, telemetry summaries, root causes, and operator recommendations into a single review dossier.

**Input Parameters:**

- `incidents` (`list` of objects): Each object must contain:
  - `incident_id` (`string`)
  - `cluster_name` (`string`)
  - `root_cause` (`string`)
  - `evidence` (`object` containing telemetry summary metrics)
  - `recommended_action` (`string`)

**Return Schema (JSON Object):**

```json
{
  "docket_id": "string",
  "status": "CREATED",
  "timestamp": "ISO-8601 string"
}
```

---

## 3. Mock Data & Prototype Rules

### Stage 1 Prototype Cluster Mapping (Hardcoded)

For testing and prototype execution, simulate the Stage 1 spatial-temporal filter with a simple hardcoded mapping function:

```python
# Prototype Mock Rule: Maps 15 incoming alert IDs directly to 2 incident clusters
MOCK_STAGE1_CLUSTERS = {
    "Cluster_A": {
        "cluster_name": "Lane 7 Bottleneck",
        "raw_alert_ids": [
            "ALT-001", "ALT-002", "ALT-003", 
            "ALT-004", "ALT-005", "ALT-006", 
            "ALT-007", "ALT-008", "ALT-009"
        ],
        "target_entity": "Lane_7"
    },
    "Cluster_B": {
        "cluster_name": "BCSS Charger Trip",
        "raw_alert_ids": [
            "ALT-010", "ALT-011", "ALT-012", 
            "ALT-013", "ALT-014", "ALT-015"
        ],
        "target_entity": "BCSS-02"
    }
}
```

---

### Scenario Mock Data (Embedded in MCP Servers)

#### Scenario A: Lane 7 Bottleneck (AGV-104)

- **Lane 7 Lead AGV:** `AGV-104`
- **Blocked Vehicles:** `["AGV-104", "AGV-109", "AGV-112"]`
- **AGV-104 Telemetry:**
  - `twistlock_sensor`: `"ENGAGED"`
  - `twistlock_command`: `"RELEASE"`
  - `hydraulic_pressure_bar`: `275.0`
  - `error_register`: `"ERR_TWISTLOCK_TIMEOUT"`

#### Scenario B: BCSS Charger Trip (BCSS-02)

- **BCSS-02 Status:**
  - `breaker_state`: `"TRIPPED"`
  - `bus_temperature_c`: `82.4`
  - `voltage_v`: `0.0`
  - `trip_reason`: `"OVERTEMP_THERMAL_CUTOFF"`

---

## 4. Implementation Guidelines for Code Generation

### Imports & Setup

Use `fastmcp` for quick server instantiations:

```python
from fastmcp import FastMCP
```

### Type Annotations & Return Serialization

- Provide full Type Hints (`str`, `float`, `list`, `dict`) for function parameters and return types.
- Always return Python native `dict` or `list` objects so FastMCP automatically serializes them into valid JSON strings over standard output.

### Type Annotations & Docstrings

Write explicit docstrings for each function—MCP relies on tool docstrings and parameter types to auto-generate the JSON schemas presented to the LLM agent.

### Execution Entrypoints

Include standard `if __name__ == "__main__":` blocks to start the server over `stdio` transport.

```python
if __name__ == "__main__":
    # Server startup code here
    mcp.run(transport="stdio")
```

---

## 5. Verification Checklist

Upon generating the code, verify that:

- [ ] All servers run cleanly using Python 3.11+.
- [ ] Every MCP tool returns a strict JSON object/dict, not plain text or markdown.
- [ ] Stage 1 uses the mock dictionary map to cleanly yield the 2 target clusters.
- [ ] Each tool accepts valid JSON inputs and returns structured JSON responses matching the schemas above.
- [ ] Tool docstrings clearly describe the tool purpose for LLM function calling.
- [ ] Both servers can run simultaneously and communicate over stdio transport.
- [ ] Error handling is implemented for invalid inputs (e.g., non-existent AGV IDs).
- [ ] Mock data is easily configurable for different test scenarios.

---

## Appendix: Quick Start Commands

```bash
# Install dependencies
pip install mcp fastmcp

# Run telemetry server
python telemetry_server.py

# Run docket service
python docket_server.py
```
```
