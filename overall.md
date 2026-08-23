# Terminal Incident Triage & Root Cause Investigation Pipeline

## Executive Overview

Modern automated container terminals generate high-velocity telemetry and alert streams across automated guided vehicles (AGVs), battery charging and swapping stations (BCSS), and quay crane interfaces. During operational anomalies, cascading alarms create noise that overwhelms human operators.

This three-stage pipeline provides a resilient, token-efficient, and deterministic architecture that compresses raw alarm streams, assigns specialized investigator agents, and gathers verifiable multimodal hardware evidence via the Model Context Protocol (MCP) to produce a single actionable Human Review Docket.

---

## Stage 1: Deterministic Filtering & Alert Clustering

### Objective

Filter baseline noise and collapse high-frequency, correlated raw alarms into discrete incident clusters using spatial-temporal correlation and terminal topology without incurring Large Language Model (LLM) token overhead.

### Mechanism & Flow

- **Raw Stream Ingestion:** Ingests live telemetry anomalies, sensor threshold flags, and traffic stop notices from field detectors.
- **Deterministic Noise Elimination:** Drops informational updates, nominal weather advisories, and routine cycle-completion events.
- **Spatial-Temporal Clustering:** Maps alerts occurring within connected physical segments and overlapping time windows into unified incident groups.
- **Zero-Token Output:** Produces discrete, structured incident payloads ready for agent handoff.

### Incident Cluster Mapping

| Cluster Identifier | Incident Name | Primary Location | Triggering Alert Signatures |
| --- | --- | --- | --- |
| **Cluster A** | Lane Bottleneck & Starvation | Transfer Lane 7 | Congestion alerts, AGV actuator timeouts, zero-headway flags, quay crane wait status. |
| **Cluster B** | High-Voltage Charging Outage | Station BCSS-02 | Main breaker trip, busbar overtemperature alarms, bus voltage drops, session aborts. |
| **Cluster C** | Fleet Energy Starvation Risk | Sector A / Buffer | Critical low state-of-charge flags, charger reassignment failures, queue deadlocks. |

---

## Stage 2: Coordinator Delegation & Topological Assessment

### Objective

Evaluate broad operational risk across the terminal layout, determine upstream and downstream asset impact, and spawn dedicated, specialized investigator agents per incident cluster.

### Operational Responsibilities

#### 1. Topological Impact Analysis

Before dispatching agents, the Coordinator queries asset relationship graphs to establish operational severity:

- **Upstream Dependencies:** Identifies feeder yard blocks and buffer zones feeding blocked zones.
- **Downstream Criticality:** Measures immediate impact on high-value machinery (e.g., assessing whether a transfer lane jam is actively starving a Quay Crane on a docked vessel).

#### 2. Agent Instantiation & Scope Isolation

The Coordinator allocates dedicated context budgets by spawning isolated investigator sub-agents:

- **Agent 1 (Lane Investigator):** Assigned exclusively to Cluster A to diagnose vehicle kinematics, queue order, and mechanical actuators.
- **Agent 2 (Infrastructure Investigator):** Assigned exclusively to Cluster B to evaluate power distribution, thermal curves, and electrical switchgear.
- **Context Protection:** Prevents cross-contamination of diagnostic schemas and minimizes overall token consumption.

---

## Stage 3: Evidence Gathering via Model Context Protocol (MCP)

### Objective

Equip investigator agents with secure, standardized tool interfaces to query industrial SCADA backends, PLC fault registers, and asset service histories to verify the true root cause of each failure.

### Architecture of MCP Servers

#### Fleet Telemetry Server (`mcp-terminal-telemetry`)

Acts as the industrial gateway to real-time AGV position controllers, queue monitors, and charging station hardware sensors.

- **Queue Order Resolution:** Resolves lane ordering to identify the blocking lead asset versus following vehicles stopped due to safety headway.
- **Live Actuator Telemetry:** Queries high-frequency mechanical pressure, pin engagement states, speed, and motor temperatures.
- **Station Electrical Metrics:** Measures busbar voltages, current draw, breaker trip registers, and coolant loop pressures.

#### Hardware Diagnostics & Lifecycle Server (`mcp-terminal-diagnostics`)

Interfaces with programmable logic controllers (PLCs) and enterprise maintenance databases.

- **PLC Fault Code Decoding:** Translates hexadecimal error registers into standardized diagnostic fault descriptions, failure mechanisms, and recovery instructions.
- **Asset Service Logs:** Retrieves historical work orders, recent component replacements, and recurring fault frequencies over rolling 30-day windows.

#### Docket Publishing Service (`mcp-docket-service`)

Standardizes agent output into a centralized queue for operational supervisors.

- Validates that all evidence fields contain verified sensor timestamps and diagnostic proof.
- Assembles multi-agent findings into a single operator-facing review structure.

---

## Investigation Workflow & Root Cause Verification

### Incident A Execution Walkthrough (Lane 7 Bottleneck)

1. **Lead Vehicle Identification:** The Lane Investigator calls the telemetry server to inspect Lane 7. The tool identifies AGV-104 as the stalled lead vehicle holding up trailing units (AGV-109, AGV-112).
2. **Kinematic & Sensor Telemetry:** Querying AGV-104 reveals that while the vehicle received a release command, the mechanical twistlock sensor remains locked and hydraulic line pressure spiked to maximum relief levels (275 bar).
3. **Diagnostic Translation:** Querying the diagnostic server decodes the fault code as a twistlock disengagement physical timeout caused by corner casting binding or pressure overload.
4. **Maintenance Context:** Cross-referencing maintenance records reveals recent actuator hydraulic line replacement, pointing toward mechanical binding rather than an electrical sensor error.

### Incident B Execution Walkthrough (BCSS-02 Charger Trip)

1. **Substation State Check:** The Infrastructure Investigator queries BCSS-02 electrical status, finding zero output voltage, an open circuit breaker, and elevated internal busbar temperatures (82.4°C).
2. **PLC Fault Lookup:** Decoding the hardware fault flags an overtemperature safety cutoff triggered when temperatures exceeded safety limits.
3. **Historical Cross-Check:** Maintenance logs show a recent DC contactor replacement and documented cooling loop fluctuations, verifying that cooling system degradation caused the thermal trip under sustained charging loads.

---

## Synthesized Human Review Docket

The final deliverable of the pipeline is a consolidated operational dossier delivered to the terminal supervisor console.

```
================================================================================
INCIDENT REVIEW DOCKET: CONSOLIDATED TERMINAL DISPATCH
Generated: Real-Time Automated Triage Engine
Status: Action Required
================================================================================

[ INCIDENT A: TRANSFER LANE 7 BOTTLENECK ]
- Severity: CRITICAL (Quay Crane QC-03 Starvation / Vessel Berth 2 Stalled)
- Root Cause: Mechanical twistlock pin jam on lead vehicle AGV-104.
- Physical Evidence:
  * AGV-104 hydraulic pressure peaked at 275 bar under RELEASE command.
  * PLC Fault 0x7E1 (ERR_TWISTLOCK_TIMEOUT) confirmed.
  * Trailing vehicles (AGV-109, AGV-112) nominal; stopped purely by safety headway.
- Recommended Action: Dispatch mobile mechanical crew to Lane 7 for manual 
  twistlock override on AGV-104; clear lane buffer.

--------------------------------------------------------------------------------

[ INCIDENT B: CHARGER BCSS-02 THERMAL TRIP ]
- Severity: HIGH (Sector A Fast-Charging Capacity Constrained)
- Root Cause: DC busbar overtemperature protection cutoff (82.4°C).
- Physical Evidence:
  * Station main breaker tripped; zero voltage output.
  * PLC Fault 0x9B4 (OVERTEMP_THERMAL_CUTOFF) confirmed.
  * Coolant differential pressure drop reported prior to cutoff.
- Recommended Action: Reroute Sector A charging queues to BCSS-01; dispatch 
  electrical technician to inspect BCSS-02 coolant circulation loop.
================================================================================
```

---

## Architectural Advantages

- **High Noise Immunity:** Purely deterministic clustering prevents alert floods from polluting reasoning context or triggering unnecessary LLM invocations.
- **Isolated Blast Radius:** Investigator sub-agents operate independently; a failure in diagnosing one station does not affect parallel investigations in transport lanes.
- **Industrial Protocol Safety:** MCP tools create a strictly typed boundary between LLM reasoning engines and critical operational technology networks (SCADA/CAN bus).
- **Decisive Human Handoff:** Operators receive concrete root causes backed by sensor readings and maintenance histories rather than raw, disjointed alarm lists.

---

## Implementation Notes

### Key Components

1. **Alert Ingestion Layer**
   - Real-time message queue integration
   - Schema validation and normalization
   - Timestamp synchronization across distributed sensors

2. **Clustering Engine**
   - Spatial topology graph (terminal layout)
   - Time-window correlation algorithm
   - Configurable thresholds for cluster merging

3. **MCP Server Architecture**
   - Separate processes for telemetry, diagnostics, and docket services
   - Standardized JSON schemas for all tool responses
   - Secure authentication for SCADA/PLC access

4. **Agent Orchestration**
   - Parallel execution of investigator agents
   - Context isolation per incident cluster
   - Structured output contracts for docket submission

### Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `CLUSTER_TIME_WINDOW_SEC` | 300 | Time window for spatial-temporal correlation |
| `MIN_ALERTS_PER_CLUSTER` | 2 | Minimum alerts to form an incident cluster |
| `MAX_AGENT_CONTEXT_TOKENS` | 2000 | Token budget per investigator agent |
| `MCP_TIMEOUT_MS` | 5000 | Tool call timeout for industrial systems |
| `DOCKET_RETENTION_HOURS` | 72 | Retention period for human review dockets |

### Error Handling

- **Tool Timeout:** Return structured error with retry guidance
- **Invalid Parameters:** Validate against schema before SCADA query
- **Partial Data:** Flag incomplete evidence in docket submission
- **System Unavailable:** Queue investigation for retry with backoff

### Security Considerations

- **Network Segmentation:** MCP servers on isolated industrial VLAN
- **Read-Only Access:** Telemetry queries never send commands to field devices
- **Audit Logging:** All agent tool calls logged with timestamp and session ID
- **Data Encryption:** TLS for all non-stdio transport modes
```