export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NOMINAL';

export interface Alert {
  id: string;
  timestamp: string;
  source: string;
  type: string;
  severity: SeverityLevel;
  message: string;
  isFilteredNoise?: boolean;
}

export interface IncidentCluster {
  id: string; // 'Cluster A', 'Cluster B', 'Cluster C'
  name: string;
  location: string;
  severity: SeverityLevel;
  status: 'INVESTIGATING' | 'READY_FOR_REVIEW' | 'RESOLVED';
  affectedAssets: string[];
  downstreamImpact: string;
  assignedAgent: {
    name: string;
    role: string;
    status: 'idle' | 'running' | 'completed';
    contextTokens: number;
    maxTokens: number;
  };
  triggeringAlerts: string[];
  telemetrySnapshot: {
    label: string;
    value: string | number;
    unit: string;
    threshold?: number;
    isAnomaly: boolean;
  }[];
}

export interface MCPToolCall {
  id: string;
  timestamp: string;
  server: 'mcp-terminal-telemetry' | 'mcp-terminal-diagnostics' | 'mcp-docket-service';
  tool: string;
  params: Record<string, any>;
  response: Record<string, any>;
  durationMs: number;
}

export interface DocketItem {
  id: string;
  clusterId: string;
  title: string;
  severity: SeverityLevel;
  impact: string;
  rootCause: string;
  physicalEvidence: {
    icon?: string;
    text: string;
    verified: boolean;
    timestamp: string;
  }[];
  plcRegisters?: {
    code: string;
    name: string;
    description: string;
    category: string;
    status: string;
  }[];
  recommendedActions: string[];
  dispatchedAction?: string;
  dispatchStatus?: 'PENDING' | 'DISPATCHED' | 'ACKNOWLEDGED';
}

export interface TerminalTelemetryPoint {
  time: string;
  hydraulicPressureBar: number;
  busbarTempC: number;
  coolingPressurePsi: number;
  batterySocPct: number;
}
