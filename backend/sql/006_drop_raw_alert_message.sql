-- ============================================================================
-- Drop raw_alerts.message.
--
-- WHY: the seeded messages state the diagnosis outright — "Twistlock release
-- actuator timed out", "Pressure reached 275 bar limit", "Busbar temperature
-- exceeded 80.0C threshold". Any agent handed those is paraphrasing an answer
-- it was given, not deriving one, and the pipeline looks far more capable than
-- it is.
--
-- The backend no longer reads this column at all:
--   * clustering/adapter.py derives vehicle, crane and safety-channel from
--     `source`, `type` and `location`
--   * clustering/problem_types.py classifies from fault codes and `source`
--   * agent/facts.py whitelists the fields an LLM may see, and `message` is
--     not on the list
--
-- Clustering output was verified byte-identical with and without the column,
-- so dropping it changes no incident, no grouping and no routing.
--
-- ⚠️ RUN THIS LAST, and only when you are ready. It is destructive and the
-- text is not recoverable from anywhere else in the schema.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Keep a copy first. Skip only if you are certain you will not want it back
--    (e.g. for a demo that shows what the agent was NOT told).
-- ---------------------------------------------------------------------------
create table if not exists public.raw_alerts_message_archive as
select id, message from public.raw_alerts;

-- ---------------------------------------------------------------------------
-- 2. Drop the column.
-- ---------------------------------------------------------------------------
alter table public.raw_alerts drop column if exists message;

-- ---------------------------------------------------------------------------
-- 3. Frontend note.
--
-- The UI still renders alert.message in four places. `message` was made
-- optional on the RawAlert type and every read guarded, so the pages degrade to
-- showing the alert type instead of breaking — but they will look emptier.
-- Affected: AlertsClustersPage (table + drawer + telemetry preview),
-- TimeRibbonPage (inspector), IncidentTimeRibbon (tooltip),
-- AgentSpawningPage (alert list).
-- ---------------------------------------------------------------------------

-- To restore (only works if step 1 ran):
--   alter table public.raw_alerts add column if not exists message text;
--   update public.raw_alerts a set message = x.message
--   from public.raw_alerts_message_archive x where x.id = a.id;
