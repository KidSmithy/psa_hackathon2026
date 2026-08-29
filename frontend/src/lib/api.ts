import { DocketItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface InvestigateResult {
  dockets: DocketItem[];
  correlation: { linked_groups: { incident_ids: string[]; reason: string }[] } | null;
  docketResult: { docket_id: string; status: string; timestamp: string } | null;
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
  node: string; // e.g. 'lane_investigator', 'correlation', 'submit_docket', or 'complete'
  output: any;
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
  const source = new EventSource(url);

  source.onopen = () => {
    console.log(`✅ [streamInvestigation] Connection opened to: ${url}`);
  };

  source.onmessage = (e) => {
    console.log(`📥 [streamInvestigation] Received event:`, e.data);
    const parsed: StreamEvent = JSON.parse(e.data);
    onEvent(parsed);
    if (parsed.node === 'complete') {
      source.close();
    }
  };
  source.onerror = (err) => {
    console.error(`❌ [streamInvestigation] EventSource error on: ${url}`, err);
    onError(err);
    source.close();
  };

  return () => {
    console.log(`🔌 [streamInvestigation] Closing connection to: ${url}`);
    source.close();
  };
}
