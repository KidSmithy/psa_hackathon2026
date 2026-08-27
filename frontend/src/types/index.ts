export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | 'NOMINAL';

export interface RawAlert {
  id: string;
  timestamp: string;
  source: string;
  type: string;
  location?: string;
  severity: SeverityLevel;
  message: string;
  isFilteredNoise?: boolean;
}

export interface AGVTelemetryRow {
  vehicle_id: string;
  speed_mps: number | string;
  twistlock_sensor: string;
  twistlock_command: string;
  hydraulic_pressure_bar: number | string;
  error_register: string;
  battery_soc_percent: number | string;
  motor_temp_c: number | string;
  wa_id?: string | null;
  wi_status?: string | null;
  load_state?: string | null;
  driving_state?: string | null;
  protective_field_violation?: boolean | null;
}

export interface LaneQueueRow {
  lane_id: string;
  lead_vehicle_id: string;
  blocked_vehicles: string[];
  status: 'BLOCKED' | 'SLOWED' | 'FLOWING' | string;
  headway_distance_m: number | string;
}

export interface BCSSChargerRow {
  station_id: string;
  breaker_state: 'NOMINAL' | 'TRIPPED' | 'FAULT' | 'IDLE' | string;
  bus_temperature_c: number | string;
  voltage_v: number | string;
  current_a: number | string;
  trip_reason?: string | null;
}

export interface PLCFaultCodeRow {
  fault_code: string;
  hex_code: string;
  device_type: string;
  description: string;
  possible_causes: string[];
  recommended_action: string;
}

export interface IncidentClusterRow {
  cluster_id: string;
  name: string;
  primary_location: string;
  assigned_agent: string;
  raw_alert_ids: string[];
  schema_version?: string;
  suggested_priority?: {
    score: number;
    reasonCodes: string[];
  } | null;
  clustering_metadata?: {
    method: string;
    rawAlertCount: number;
    spatialWindowMeters: number;
    temporalWindowSeconds: number;
  } | null;
  participating_vehicles?: {
    role: string;
    vehicleId: string;
    workAssignment?: {
      waId: string;
      wiStatus: string;
    };
  }[] | null;
}

export interface ClusterWithAlerts extends IncidentClusterRow {
  alerts: RawAlert[];
  highestSeverity: SeverityLevel;
}

// ---------------- Yard Topology Types ----------------
export type YardNodeType = 'junction' | 'lane' | 'charger' | 'crane_handoff' | 'sector';

export interface YardNode {
  id: string;
  type: YardNodeType;
  x: number;
  y: number;
  label: string;
  zoneId?: string;
}

export interface YardEdge {
  from: string;
  to: string;
}

export interface YardExtent {
  xMax: number;
  yMax: number;
}

export interface YardGraph {
  nodes: YardNode[];
  edges: YardEdge[];
  extent: YardExtent;
}

// ---------------- Incident Time Ribbon & Scrubber Types ----------------
export interface TimeBracket {
  bracketId: string;
  incidentId: string;
  startTime: string;
  endTime: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  alertIds: string[];
  alerts: RawAlert[];
  severity: SeverityLevel;
}

export interface IncidentLaneData {
  incident: ClusterWithAlerts;
  brackets: TimeBracket[];
  allAlertsSorted: RawAlert[];
}

export interface InterpolatedAGVState {
  vehicleId: string;
  x: number;
  y: number;
  speed: number;
  headingRad: number;
  drivingState: string;
  loadState: string;
  batteryPct: number;
  hydraulicPressureBar: number;
  motorTempC: number;
  errorRegister: string;
  isProtectiveFieldViolated: boolean;
  isWarning: boolean;
  isCritical: boolean;
  activeIncidentId: string | null;
  currentAlertId: string | null;
  nearestNamedFeature?: string;
}

// Backward compatibility types
export type Alert = RawAlert;

export interface IncidentCluster {
  id: string;
  name: string;
  location: string;
  severity: SeverityLevel;
  status: string;
  affectedAssets: string[];
  downstreamImpact: string;
  assignedAgent: {
    name: string;
    role: string;
    status: string;
    contextTokens: number;
    maxTokens: number;
  };
  triggeringAlerts: string[];
  telemetrySnapshot: {
    label: string;
    value: number | string;
    unit: string;
    threshold?: number;
    isAnomaly: boolean;
  }[];
}

export interface DocketItem {
  id: string;
  clusterId: string;
  title: string;
  severity: SeverityLevel;
  impact: string;
  rootCause: string;
  dispatchStatus?: string;
  physicalEvidence: {
    text: string;
    timestamp: string;
    verified: boolean;
  }[];
  plcRegisters?: {
    code: string;
    name: string;
    status: string;
    description: string;
    category?: string;
  }[];
  recommendedActions: string[];
}

export interface MCPToolCall {
  id: string;
  agentId?: string;
  server: string;
  tool: string;
  timestamp: string;
  durationMs: number;
  status?: 'SUCCESS' | 'FAILED' | 'PENDING' | string;
  params?: Record<string, any>;
  result?: Record<string, any>;
  response?: Record<string, any>;
}

export interface TerminalTelemetryPoint {
  time: string;
  agvHeadwayMeters?: number;
  agvPressureBar?: number;
  hydraulicPressureBar?: number;
  bcssBusTempC?: number;
  busbarTempC?: number;
  coolingPressurePsi?: number;
  batterySocPct?: number;
  scadaMsgFrequencyHz?: number;
}
