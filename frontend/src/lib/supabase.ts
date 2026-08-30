import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in frontend/.env (see .env.example).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Which incident table the UI reads.
 *
 * `incident_clusters` is the original hand-seeded CLUSTER-A..D snapshot and
 * stays untouched, so the previous working demo is always one env var away.
 * `incident_clusters_v2` is what the open clustering algorithm writes (see
 * backend/sql/002_open_clustering.sql) — same five core columns, plus problem
 * type, priority score and clustering metadata.
 */
export const CLUSTERS_TABLE =
  import.meta.env.VITE_CLUSTERS_TABLE || 'incident_clusters';
