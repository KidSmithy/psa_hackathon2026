-- ============================================================================
-- Stage 1 open clustering — v2 tables
--
-- Run this once in the Supabase SQL Editor.
--
-- Nothing here touches the existing tables. `incident_clusters` (the
-- hand-seeded CLUSTER-A..D snapshot) stays exactly as it is and remains the
-- working v1 demo: set STAGE1_SOURCE=table in backend/.env to go back to it at
-- any time. Everything the algorithm generates lands in these new tables.
--
-- Why new tables rather than versioning the old one: Postgres has no built-in
-- row versioning, and `incident_clusters.cluster_id` is the primary key. Open
-- clustering regenerates incident ids on every run, so writing them into the
-- v1 table would either collide with the seeded rows or force you to mix two
-- generations of data under one primary key. A parallel table keeps both
-- generations queryable and lets you switch the UI over with a table name.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- One row per Stage 1 execution. Lets you tell which run produced which
-- incidents, and what config it ran with.
-- ---------------------------------------------------------------------------
create table if not exists public.stage1_runs (
    run_id           text primary key,
    created_at       timestamptz not null default now(),
    config           jsonb       not null default '{}'::jsonb,
    stats            jsonb       not null default '{}'::jsonb,
    noise_alert_ids  jsonb       not null default '[]'::jsonb
);

-- ---------------------------------------------------------------------------
-- Incidents produced by the algorithm.
--
-- The first five columns are byte-identical in name and type to
-- public.incident_clusters, so any query or UI already reading v1 works
-- against v2 after changing only the table name. Everything after them is new
-- information the open clustering algorithm produces.
-- ---------------------------------------------------------------------------
create table if not exists public.incident_clusters_v2 (
    -- v1-compatible core
    cluster_id             text primary key,          -- e.g. 'INC-2026-0823-0001'
    name                   text not null,             -- generated, e.g. 'Lane 7 mainline - Traffic Flow Blockage'
    primary_location       text not null,             -- raw DB spelling, e.g. 'Lane_7'
    assigned_agent         text not null,             -- derived from problem type
    raw_alert_ids          jsonb not null default '[]'::jsonb,

    -- open-clustering columns
    run_id                 text references public.stage1_runs (run_id) on delete cascade,
    schema_version         text,
    problem_type           text,                      -- e.g. 'TRAFFIC_FLOW'
    problem_type_label     text,                      -- e.g. 'Traffic Flow Blockage'
    is_singleton           boolean not null default false,
    assigned_domain        text,                      -- investigator node name
    created_at             timestamptz,
    nearest_named_feature  text,
    coordinates            jsonb,                     -- {"x": .., "y": ..}
    suggested_priority     jsonb,                     -- {"score": .., "reasonCodes": [..]}
    clustering_metadata    jsonb,                     -- method, windows, member ids, topology match
    participating_vehicles jsonb,
    evidence_refs          jsonb,
    incident_metadata      jsonb                      -- priority breakdown, chain guard, member times
);

create index if not exists incident_clusters_v2_run_id_idx
    on public.incident_clusters_v2 (run_id);
create index if not exists incident_clusters_v2_problem_type_idx
    on public.incident_clusters_v2 (problem_type);

-- ---------------------------------------------------------------------------
-- Safety-channel alerts. These bypass priority scoring entirely and route
-- straight to an immediate escalation, so they are not incidents and do not
-- belong in the clusters table.
-- ---------------------------------------------------------------------------
create table if not exists public.safety_escalations (
    escalation_id    text primary key,                -- e.g. 'ESC-2026-0823-0001'
    run_id           text references public.stage1_runs (run_id) on delete cascade,
    schema_version   text,
    route            text,
    escalation_tier  text,
    raised_at        timestamptz,
    source_alert_id  text,
    vehicle_id       text,
    error_code       text,
    eci_event        text,
    location         jsonb,
    last_state       jsonb,
    evidence_refs    jsonb
);

create index if not exists safety_escalations_run_id_idx
    on public.safety_escalations (run_id);

-- ---------------------------------------------------------------------------
-- Row Level Security.
--
-- The frontend reads with the anon key, so these need a read policy to be
-- visible at all — matching however public.incident_clusters is already set
-- up. Writes come from the backend using SUPABASE_KEY; if that is the service
-- role key it bypasses RLS and needs no write policy. If you are using the
-- anon key on the backend too, uncomment the write policies below.
-- ---------------------------------------------------------------------------
alter table public.stage1_runs           enable row level security;
alter table public.incident_clusters_v2  enable row level security;
alter table public.safety_escalations    enable row level security;

drop policy if exists stage1_runs_read on public.stage1_runs;
create policy stage1_runs_read on public.stage1_runs
    for select using (true);

drop policy if exists incident_clusters_v2_read on public.incident_clusters_v2;
create policy incident_clusters_v2_read on public.incident_clusters_v2
    for select using (true);

drop policy if exists safety_escalations_read on public.safety_escalations;
create policy safety_escalations_read on public.safety_escalations
    for select using (true);

-- Uncomment only if the backend writes with the anon key rather than the
-- service role key. This grants anonymous writes — do not ship it beyond a
-- hackathon demo.
--
-- create policy stage1_runs_write on public.stage1_runs
--     for all using (true) with check (true);
-- create policy incident_clusters_v2_write on public.incident_clusters_v2
--     for all using (true) with check (true);
-- create policy safety_escalations_write on public.safety_escalations
--     for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Optional: a view that makes v2 look exactly like v1, if you would rather
-- point the frontend at a v1-shaped source while the UI work is in progress.
-- ---------------------------------------------------------------------------
create or replace view public.incident_clusters_current as
select cluster_id, name, primary_location, assigned_agent, raw_alert_ids
from public.incident_clusters_v2;
