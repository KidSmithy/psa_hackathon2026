import { Alert, IncidentCluster, MCPToolCall, DocketItem, TerminalTelemetryPoint } from '../types';

export const INITIAL_CLUSTERS: IncidentCluster[] = [
  {
    id: 'Cluster A',
    name: 'Lane Bottleneck & Starvation',
    location: 'Transfer Lane 7 (Berth 2)',
    severity: 'CRITICAL',
    status: 'READY_FOR_REVIEW',
    affectedAssets: ['AGV-104 (Lead)', 'AGV-109 (Queued)', 'AGV-112 (Queued)', 'Quay Crane QC-03'],
    downstreamImpact: 'Quay Crane QC-03 starvation on docked Vessel Berth 2. Quay crane idle timer: 4m 12s.',
    assignedAgent: {
      name: 'Agent-101',
      role: 'Lane Kinematics & Actuator Investigator',
      status: 'completed',
      contextTokens: 1140,
      maxTokens: 2000,
    },
    triggeringAlerts: [
      'Lane 7 Headway Zero-Velocity Alert',
      'AGV-104 Actuator Timeout (RELEASE)',
      'QC-03 Container Buffer Starvation',
    ],
    telemetrySnapshot: [
      { label: 'AGV-104 Hydraulic Pressure', value: 275, unit: 'bar', threshold: 220, isAnomaly: true },
      { label: 'AGV-104 Twistlock State', value: 'PIN_ENGAGED_JAM', unit: '', isAnomaly: true },
      { label: 'AGV-109 Safety Headway', value: 1.8, unit: 'm', threshold: 1.5, isAnomaly: false },
      { label: 'Lane 7 Queue Count', value: 3, unit: 'units', isAnomaly: true },
    ],
  },
  {
    id: 'Cluster B',
    name: 'High-Voltage Charging Outage',
    location: 'Station BCSS-02 (Sector A)',
    severity: 'HIGH',
    status: 'READY_FOR_REVIEW',
    affectedAssets: ['BCSS-02 Charger', 'Busbar Substation 4', 'Sector A Buffer AGVs'],
    downstreamImpact: 'Sector A fast-charging throughput reduced by 50%. 4 AGVs waiting for recharge slot.',
    assignedAgent: {
      name: 'Agent-102',
      role: 'Infrastructure & Power Investigator',
      status: 'completed',
      contextTokens: 1480,
      maxTokens: 2000,
    },
    triggeringAlerts: [
      'BCSS-02 Main Breaker Trip Register',
      'DC Busbar Overtemperature Alarm (82.4°C)',
      'Session Abort: AGV-208 Charging Fault',
    ],
    telemetrySnapshot: [
      { label: 'Busbar Temperature', value: 82.4, unit: '°C', threshold: 70.0, isAnomaly: true },
      { label: 'Output Voltage', value: 0.0, unit: 'V', threshold: 650, isAnomaly: true },
      { label: 'Coolant Flow Differential', value: -42, unit: '%', threshold: -15, isAnomaly: true },
      { label: 'Breaker Status', value: 'OPEN_TRIPPED', unit: '', isAnomaly: true },
    ],
  },
  {
    id: 'Cluster C',
    name: 'Fleet Energy Starvation Risk',
    location: 'Sector A Buffer & Depot',
    severity: 'MEDIUM',
    status: 'INVESTIGATING',
    affectedAssets: ['AGV-208', 'AGV-215', 'AGV-221'],
    downstreamImpact: 'Battery state-of-charge dropping below 18% on active transport loops.',
    assignedAgent: {
      name: 'Agent-103',
      role: 'Fleet Energy & Queue Balancer',
      status: 'running',
      contextTokens: 820,
      maxTokens: 2000,
    },
    triggeringAlerts: [
      'Critical Low SoC Threshold Warning',
      'Charger Reassignment Queue Deadlock',
    ],
    telemetrySnapshot: [
      { label: 'Avg Sector A SoC', value: 17.8, unit: '%', threshold: 25, isAnomaly: true },
      { label: 'Pending Reassignments', value: 4, unit: 'queues', isAnomaly: true },
    ],
  },
];

export const RAW_ALERTS: Alert[] = [
  { id: 'ALT-901', timestamp: '20:44:12', source: 'SCADA_LANE_07', type: 'CONGESTION_FLAG', severity: 'HIGH', message: 'Traffic velocity zero in Lane 7 segment B' },
  { id: 'ALT-902', timestamp: '20:44:15', source: 'AGV_104_PLC', type: 'ACTUATOR_ERR', severity: 'CRITICAL', message: 'Twistlock disengage failed: Timeout 5000ms exceeded' },
  { id: 'ALT-903', timestamp: '20:44:18', source: 'QC_03_TOS', type: 'STARVATION_WARN', severity: 'CRITICAL', message: 'Inbound container feed starvation on Berth 2' },
  { id: 'ALT-904', timestamp: '20:44:20', source: 'BCSS_02_PLC', type: 'BREAKER_TRIP', severity: 'CRITICAL', message: 'Main contactor open on thermal protection trip' },
  { id: 'ALT-905', timestamp: '20:44:22', source: 'BCSS_02_THM', type: 'BUSBAR_TEMP', severity: 'HIGH', message: 'Busbar thermal probe reads 82.4°C (Limit: 70°C)' },
  { id: 'ALT-906', timestamp: '20:44:25', source: 'ENV_WEATHER_01', type: 'NOISE_FILTERED', severity: 'LOW', message: 'Wind gust 14 knots nominal at gantry top', isFilteredNoise: true },
  { id: 'ALT-907', timestamp: '20:44:28', source: 'AGV_109_RADAR', type: 'HEADWAY_HOLD', severity: 'LOW', message: 'Safe headway hold behind lead vehicle AGV-104', isFilteredNoise: true },
  { id: 'ALT-908', timestamp: '20:44:31', source: 'YARD_BLOCK_C', type: 'CYCLE_COMPLETE', severity: 'NOMINAL', message: 'Routine stack container movement cycle finished', isFilteredNoise: true },
];

export const MCP_TOOL_HISTORY: MCPToolCall[] = [
  {
    id: 'TOOL-01',
    timestamp: '20:44:32',
    server: 'mcp-terminal-telemetry',
    tool: 'get_lane_queue_order',
    params: { laneId: 'Lane-07', includeTrailingHeadway: true },
    response: {
      leadAsset: 'AGV-104',
      status: 'STALLED',
      queue: ['AGV-104', 'AGV-109', 'AGV-112'],
      trailingNominal: true,
      blockReason: 'LEAD_ASSET_ZERO_HEADWAY'
    },
    durationMs: 42,
  },
  {
    id: 'TOOL-02',
    timestamp: '20:44:34',
    server: 'mcp-terminal-telemetry',
    tool: 'query_actuator_telemetry',
    params: { assetId: 'AGV-104', sensor: 'hydraulic_twistlock' },
    response: {
      pressureBar: 275.4,
      limitBar: 220.0,
      twistlockPinState: 'LOCKED',
      commandSent: 'RELEASE_DISENGAGE',
      reliefValveActive: true
    },
    durationMs: 38,
  },
  {
    id: 'TOOL-03',
    timestamp: '20:44:37',
    server: 'mcp-terminal-diagnostics',
    tool: 'decode_plc_fault_code',
    params: { register: '0x7E1', controller: 'CAN_ACTUATOR_V3' },
    response: {
      hex: '0x7E1',
      symbol: 'ERR_TWISTLOCK_TIMEOUT',
      category: 'MECHANICAL_HYDRAULIC_BIND',
      description: 'Twistlock disengagement physical timeout caused by corner casting binding or pressure overload.'
    },
    durationMs: 51,
  },
  {
    id: 'TOOL-04',
    timestamp: '20:44:40',
    server: 'mcp-terminal-diagnostics',
    tool: 'get_asset_service_history',
    params: { assetId: 'AGV-104', lookbackDays: 30 },
    response: {
      lastWorkOrder: 'WO-88219 (Actuator hydraulic line replacement, 3 days ago)',
      recurringBindingIncidents: 1,
      conclusion: 'Mechanical binding in corner casting rather than sensor circuit failure.'
    },
    durationMs: 64,
  },
  {
    id: 'TOOL-05',
    timestamp: '20:44:42',
    server: 'mcp-terminal-telemetry',
    tool: 'get_station_electrical_metrics',
    params: { stationId: 'BCSS-02' },
    response: {
      busbarTempC: 82.4,
      thresholdC: 70.0,
      breakerState: 'TRIPPED',
      outputVoltage: 0.0,
      coolantDeltaPressure: -42.1
    },
    durationMs: 35,
  },
  {
    id: 'TOOL-06',
    timestamp: '20:44:45',
    server: 'mcp-terminal-diagnostics',
    tool: 'decode_plc_fault_code',
    params: { register: '0x9B4', controller: 'BCSS_POWER_MODULE_02' },
    response: {
      hex: '0x9B4',
      symbol: 'OVERTEMP_THERMAL_CUTOFF',
      category: 'ELECTRICAL_SAFETY_INTERLOCK',
      description: 'DC busbar overtemperature safety cutoff triggered after coolant circulation degradation.'
    },
    durationMs: 48,
  }
];

export const INITIAL_DOCKETS: DocketItem[] = [
  {
    id: 'DOCKET-A',
    clusterId: 'Cluster A',
    title: 'TRANSFER LANE 7 BOTTLENECK & STARVATION',
    severity: 'CRITICAL',
    impact: 'Quay Crane QC-03 Starvation / Vessel Berth 2 Stalled (Idle timer: 4m 12s)',
    rootCause: 'Mechanical twistlock pin jam on lead vehicle AGV-104 due to corner casting binding under 275 bar relief pressure.',
    physicalEvidence: [
      { text: 'AGV-104 hydraulic pressure peaked at 275 bar under RELEASE command (relief valve triggered).', verified: true, timestamp: '20:44:34' },
      { text: 'PLC Fault 0x7E1 (ERR_TWISTLOCK_TIMEOUT) decoded on CAN_ACTUATOR_V3 controller.', verified: true, timestamp: '20:44:37' },
      { text: 'Trailing vehicles (AGV-109, AGV-112) verified nominal; stopped purely by safety headway distance (1.8m).', verified: true, timestamp: '20:44:32' },
      { text: 'Cross-referenced maintenance history: WO-88219 (Hydraulic line replacement 3 days ago).', verified: true, timestamp: '20:44:40' }
    ],
    plcRegisters: [
      { code: '0x7E1', name: 'ERR_TWISTLOCK_TIMEOUT', description: 'Actuator physical disengage timeout > 5000ms', category: 'Actuator Mechanical', status: 'ACTIVE_FAULT' },
      { code: '0x3A2', name: 'HEADWAY_BRAKE_SAFE', description: 'Radar safety distance interlock active (AGV-109)', category: 'Safety Kinematics', status: 'NOMINAL_HOLD' }
    ],
    recommendedActions: [
      'Dispatch mobile mechanical crew to Lane 7 for manual twistlock override on AGV-104.',
      'Clear lane buffer and re-authorize AGV-109 & AGV-112 priority routing to Quay Crane QC-03.'
    ],
    dispatchStatus: 'PENDING'
  },
  {
    id: 'DOCKET-B',
    clusterId: 'Cluster B',
    title: 'CHARGER BCSS-02 THERMAL TRIP & CAPACITY DROP',
    severity: 'HIGH',
    impact: 'Sector A Fast-Charging Capacity Constrained (-50% capacity, 4 AGVs queued)',
    rootCause: 'DC busbar overtemperature protection cutoff (82.4°C) caused by cooling circulation loop pressure drop.',
    physicalEvidence: [
      { text: 'Station main breaker tripped; zero voltage output (0.0 V, 0.0 A draw).', verified: true, timestamp: '20:44:42' },
      { text: 'PLC Fault 0x9B4 (OVERTEMP_THERMAL_CUTOFF) confirmed on power management module.', verified: true, timestamp: '20:44:45' },
      { text: 'Coolant differential pressure drop (-42%) recorded 90 seconds prior to thermal cutoff.', verified: true, timestamp: '20:44:42' },
      { text: 'Recent maintenance log shows DC contactor replacement and cooling loop fluctuation logs.', verified: true, timestamp: '20:44:48' }
    ],
    plcRegisters: [
      { code: '0x9B4', name: 'OVERTEMP_THERMAL_CUTOFF', description: 'Busbar temp exceeded 70.0°C cutoff limit (read 82.4°C)', category: 'High Voltage Power', status: 'SAFETY_INTERLOCK' }
    ],
    recommendedActions: [
      'Reroute Sector A charging queues (AGV-208, AGV-215) to Station BCSS-01.',
      'Dispatch electrical technician to inspect BCSS-02 coolant circulation loop.'
    ],
    dispatchStatus: 'PENDING'
  }
];

export const TELEMETRY_TIME_SERIES: TerminalTelemetryPoint[] = [
  { time: '20:40', hydraulicPressureBar: 120, busbarTempC: 58.2, coolingPressurePsi: 45, batterySocPct: 88 },
  { time: '20:41', hydraulicPressureBar: 125, busbarTempC: 62.0, coolingPressurePsi: 43, batterySocPct: 87 },
  { time: '20:42', hydraulicPressureBar: 130, busbarTempC: 68.5, coolingPressurePsi: 38, batterySocPct: 86 },
  { time: '20:43', hydraulicPressureBar: 190, busbarTempC: 75.1, coolingPressurePsi: 28, batterySocPct: 85 },
  { time: '20:44', hydraulicPressureBar: 275, busbarTempC: 82.4, coolingPressurePsi: 18, batterySocPct: 83 },
  { time: '20:45', hydraulicPressureBar: 275, busbarTempC: 81.9, coolingPressurePsi: 16, batterySocPct: 82 },
];
