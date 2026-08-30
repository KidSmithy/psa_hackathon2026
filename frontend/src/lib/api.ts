import { DocketItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? 'https://psa-backend-ac66w7g76q-as.a.run.app' : 'http://localhost:8000');

export interface OrchestrationDecision {
  rationale: string;
  domains: string[];
  had_video: boolean;
}

export interface VideoFinding {
  video_id?: string;
  camera_id?: string | null;
  source_alert_ids?: string[];
  assessment?: 'CONFIRMED_INCIDENT' | 'POTENTIAL_HAZARD' | 'NORMAL_ACTIVITY' | 'UNUSABLE_FOOTAGE';
  severity?: string;
  confidence?: number;
  summary?: string;
  observations?: { timestamp: string; what_happens: string; severity: string; entities?: string[] }[];
  entities_involved?: string[];
  visual_cues?: string[];
}

export interface InvestigateResult {
  dockets: DocketItem[];
  correlation: { linked_groups: { incident_ids: string[]; reason: string }[] } | null;
  docketResult: { docket_id: string; status: string; timestamp: string } | null;
  /** Why each incident was routed where it was, keyed by incident id. */
  orchestration?: Record<string, OrchestrationDecision>;
  /** What the cameras saw, keyed by incident id. A list: the CCTV link is
   *  alert-level, so one incident can have clips from several cameras. */
  videoFindings?: Record<string, VideoFinding[]>;
}

/** Runs the full investigation and waits for the final result — no live progress. */
export async function investigate(clusterId?: string | null): Promise<InvestigateResult> {
  const res = await fetch(`${API_BASE_URL}/api/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cluster_id: clusterId ?? null }),
  });
  if (!res.ok) {
    throw new Error(`Investigation request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export interface StreamEvent {
  type?: 'node_status' | 'thought' | 'tool_start' | 'tool_end' | 'node_output' | 'error' | 'complete';
  node?: string; // e.g. 'lane_investigator', 'correlation', 'submit_docket', or 'complete'
  status?: string;
  chunk?: string;
  tool?: string;
  input?: any;
  output?: any;
  timestamp?: string;
}

/**
 * Opens the SSE stream and calls onEvent once per node as it finishes, and
 * once more with node: 'complete' carrying the final InvestigateResult.
 * Returns a cleanup function to close the connection early (e.g. on unmount).
 */
export function streamInvestigation(
  clusterId: string | null | undefined,
  onEvent: (event: StreamEvent) => void,
  onError: (err: Event) => void
): () => void {
  const params = clusterId ? `?cluster_id=${encodeURIComponent(clusterId)}` : '';
  const url = `${API_BASE_URL}/api/investigate/stream${params}`;
  console.log(`📡 [streamInvestigation] Connecting to: ${url}`);
  let isClosed = false;
  const source = new EventSource(url);

  source.onopen = () => {
    if (isClosed) return;
    console.log(`✅ [streamInvestigation] Connection opened to: ${url}`);
  };

  source.onmessage = (e) => {
    if (isClosed) return;
    console.log(`📥 [streamInvestigation] Received event:`, e.data);
    const parsed: StreamEvent = JSON.parse(e.data);
    onEvent(parsed);
    if (parsed.node === 'complete') {
      isClosed = true;
      source.close();
    }
  };
  source.onerror = (err) => {
    if (isClosed) return;
    console.error(`❌ [streamInvestigation] EventSource error on: ${url}`, err);
    onError(err);
    isClosed = true;
    source.close();
  };

  return () => {
    console.log(`🔌 [streamInvestigation] Closing connection to: ${url}`);
    isClosed = true;
    source.close();
  };
}

