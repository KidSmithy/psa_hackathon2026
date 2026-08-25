# Industrial Telemetry: Baseline vs. Anomaly Engineering Guide

## 1. Executive Summary

In automated container terminals and industrial Operational Technology (OT) environments, raw SCADA data and CAN-bus telemetry streams consist of dense numerical readings. Without contextual operational envelopes, numerical values like `82.4`, `0.0`, or `275.0` appear arbitrary.

This document establishes the **Operational Boundaries and Diagnostic Thresholds** used to differentiate healthy, nominal operations from critical hardware failures within the terminal dataset.

---

## 2. Telemetry Comparison Matrix

| Subsystem / Table | Sensor / Metric | Unit | Nominal Baseline | Incident Anomaly | Engineering Rationale & Failure Mode |
| --- | --- | --- | --- | --- | --- |
| **`bcss_chargers`** | `bus_temperature_c` | °C | **25.0 – 48.0** | **≥ 80.0** *(e.g., 82.4)* | **Thermal Runaway Risk:** Exceeds copper busbar insulation tolerance; triggers hardware safety thermal trip. |
| **`bcss_chargers`** | `voltage_v` | V | **480.0** | **0.0** | **Total Power Loss:** Breaker tripped or ground-fault interrupter opened the circuit. |
| **`bcss_chargers`** | `current_a` | A | **150.0 – 250.0** | **0.0** *(mid-cycle)* | **Session Abort:** Power delivery abruptly halted during active vehicle charge cycle. |
| **`bcss_chargers`** | `breaker_state` | State | `NOMINAL` / `IDLE` | `TRIPPED` / `FAULT` | **Protection Actuation:** Physical contactor opened to isolate an electrical fault. |
| **`agv_telemetry`** | `hydraulic_pressure_bar` | Bar | **140.0 – 160.0** | **≥ 250.0** *(e.g., 275.0)* | **Mechanical Overload / Jam:** Pump operates against dead-headed relief valve due to physical bind. |
| **`agv_telemetry`** | `twistlock_sensor` vs `twistlock_command` | State | `RELEASE` / `RELEASED`<br>

<br>`LOCK` / `LOCKED` | `RELEASE` / `ENGAGED` | **State Discrepancy:** Actuator failed to execute software release command within timeout window. |
| **`agv_telemetry`** | `battery_soc_percent` | % | **30.0 – 95.0** | **< 15.0** *(e.g., 11.8)* | **Deep Discharge Risk:** Cell voltage approaching irreversible damage threshold; risk of dead AGV blocking lanes. |
| **`agv_telemetry`** | `error_register` | Hex/Code | `OK` | `ERR_TWISTLOCK_TIMEOUT`<br>

<br>`ERR_BMS_CRITICAL_SOC` | **Deterministic PLC Error:** On-board controller registered an unrecoverable sub-system timeout. |
| **`lane_queues`** | `headway_distance_m` | Meters | **> 10.0** | **0.0 – 2.5** | **Traffic Bottleneck / Deadlock:** Zero clearance indicates a stalled lead vehicle and trailing queue cascade. |
| **`lane_queues`** | `status` | State | `FLOWING` | `BLOCKED` / `SLOWED` | **Throughput Collapse:** Transfer lane cannot service buffer zones or Quay Cranes. |

---

## 3. Subsystem Breakdown & Physical Diagnostics

### Subsystem A: High-Voltage Battery Charging Stations (`bcss_chargers`)

Automated Battery Charging and Swapping Stations (BCSS) provide continuous DC fast-charging to electric AGVs.

```
+-------------------------------------------------------------------------------+
| NOMINAL OPERATION (BCSS-01)        | ANOMALOUS INCIDENT (BCSS-02)             |
+------------------------------------+------------------------------------------+
| Voltage:  480.0 V (Active Bus)     | Voltage:  0.0 V (De-energized)           |
| Current:  185.0 A (~88.8 kW rate)  | Current:  0.0 A (Zero Current)           |
| Bus Temp: 44.1°C (Nominal cooling) | Bus Temp: 82.4°C (> 80.0°C Trip Cutoff)  |
| Breaker:  NOMINAL                  | Breaker:  TRIPPED                        |
+------------------------------------+------------------------------------------+

```

#### Why it indicates a failure:

1. **Thermal Cutoff Threshold (80.0°C):** High currents generate resistive heat on copper busbars ($P = I^2 R$). Cooling loop degradation causes thermal runaway. When the internal temperature sensor registers $\ge 80.0\text{°C}$, the safety PLC triggers `OVERTEMP_THERMAL_CUTOFF`.
2. **Breaker Actuation:** The breaker shifts to `TRIPPED`, instantly dropping `voltage_v` to `0.0 V` and `current_a` to `0.0 A` to prevent electrical fire, terminating the charging session for connected vehicles.

---

### Subsystem B: AGV Kinematics & Hydraulic Actuators (`agv_telemetry`)

Automated Guided Vehicles (AGVs) carry 20ft/40ft shipping containers using hydraulic twistlock mechanisms to secure corner castings.

```
+-------------------------------------------------------------------------------+
| NOMINAL OPERATION (AGV-109 / 201)  | ANOMALOUS INCIDENT (AGV-104)             |
+------------------------------------+------------------------------------------+
| Command:  NONE / RELEASE           | Command:  RELEASE                        |
| Sensor:   RELEASED                 | Sensor:   ENGAGED (State Mismatch)       |
| Pressure: 150.0 - 160.0 bar        | Pressure: 275.0 bar (Max Relief Limit)   |
| Speed:    3.8 m/s (In Transit)     | Speed:    0.0 m/s (Stalled)              |
| Error:    OK                       | Error:    ERR_TWISTLOCK_TIMEOUT (0x7E1)  |
+------------------------------------+------------------------------------------+

```

#### Why it indicates a failure:

1. **Command vs. Sensor Mismatch:** The vehicle PLC commanded `twistlock_command = "RELEASE"`, but the inductive position sensor reports `twistlock_sensor = "ENGAGED"`.
2. **Hydraulic Spike (275 bar):** Standard hydraulic operating pressure during pin rotation is between 140 and 160 bar. A sustained spike to **275 bar** (the mechanical pressure relief limit) proves the motor is pumping against a physically jammed corner casting rather than an electrical signal fault.
3. **Deterministic Timeout:** If the `RELEASED` limit switch is not triggered within 3000 ms, the PLC halts the vehicle and throws `ERR_TWISTLOCK_TIMEOUT`.

---

### Subsystem C: Terminal Traffic & Headway Management (`lane_queues`)

Automated transfer lanes require safety clearances between multi-ton autonomous vehicles.

```
+-------------------------------------------------------------------------------+
| NOMINAL OPERATION (Lane 8)         | ANOMALOUS INCIDENT (Lane 7)              |
+------------------------------------+------------------------------------------+
| Status:   FLOWING                  | Status:   BLOCKED                        |
| Lead AGV: AGV-201                  | Lead AGV: AGV-104 (Jammed Actuator)      |
| Queue:    ["AGV-201", "AGV-205"]   | Queue:    ["AGV-104", "AGV-109", "112"]  |
| Headway:  14.5 m                   | Headway:  0.0 m (Direct Safety Stop)     |
+------------------------------------+------------------------------------------+

```

#### Why it indicates a failure:

1. **Headway Collapse (0.0 m):** When `headway_distance_m` drops below safe stopping thresholds, trailing AGVs engage front LiDAR emergency braking to prevent collisions.
2. **Cascading Starvation:** A blocked lane cascades into feeder bottlenecks. Trailing vehicles (`AGV-109`, `AGV-112`) are functional, but their progress is halted solely due to the physical obstruction caused by `AGV-104`.

---

## 4. Purpose of Baseline (Nominal) Assets in the Dataset

To validate AI agent reasoning and prevent false positives, the dataset contains nominal control assets alongside failure records:

* **`AGV-201` & `AGV-303`:** Moving at cruising speed (3.8–4.2 m/s), nominal hydraulic pressure (150–160 bar), and healthy battery charge (> 88%).
* **`BCSS-01`:** Active fast-charging delivering 185.0 A at 480.0 V with normal thermal dissipation (44.1°C).
* **`BCSS-04`:** Idle standby station ready at 480.0 V, 28.0°C ambient temperature.

### Role in the Multi-Agent Pipeline

1. **Differential Analysis:** Stage 3 Investigator Agents compare anomalous telemetry directly against baseline operating ranges.
2. **Root Cause Isolation:** Differentiates between infrastructure-wide failures (e.g., entire grid outage) versus localized component failures (e.g., a single jammed pin on `AGV-104` or an isolated thermal trip on `BCSS-02`).