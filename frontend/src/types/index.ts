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
