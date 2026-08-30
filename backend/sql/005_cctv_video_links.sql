-- ============================================================================
-- CCTV footage: notes and optional helpers.
--
-- Nothing needs creating. The link the pipeline uses already exists in your
-- database:
--
--     raw_alerts.video_id  ->  videos.id
--
-- and 15 of the 25 seeded alerts are already linked:
--
--     agv_halfway_down.mp4     ALT-001, ALT-002, ALT-006, ALT-007, ALT-008   (Lane_7)
--     lane_block_byobject.mp4  ALT-003, ALT-004, ALT-005                     (Lane_7)
--     electricty_faulty.mp4    ALT-009 .. ALT-015                (Station_BCSS_02)
--
-- The link is ALERT-level, which is more precise than matching on location: two
-- alerts in the same lane at the same minute can come from different cameras,
-- and here they do — Lane_7's alerts split across two clips. An incident
-- inherits the union of its member alerts' clips, so open clustering produces:
--
--     INC-...-0001  TRAFFIC_FLOW         2 clips  (both Lane_7 cameras)
--     INC-...-0002  MECHANICAL_ACTUATOR  1 clip   (agv_halfway_down)
--     INC-...-0003  POWER_CHARGING       1 clip   (electricty_faulty)
--     INC-...-0005  CRANE_HANDOFF        1 clip   (agv_halfway_down)
--     the remaining 3 incidents have no footage
--
-- `videos.public_url` is a Supabase Storage public URL, which the video analyst
-- downloads before handing to Gemini. `metadata.local_path` points at the
-- machine that did the upload and is not used.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Optional: an index, if raw_alerts grows past demo size.
-- ---------------------------------------------------------------------------
create index if not exists raw_alerts_video_id_idx on public.raw_alerts (video_id);

-- ---------------------------------------------------------------------------
-- Optional: descriptions. All three rows currently have description = null.
--
-- ⚠️ These are for the docket and for humans ONLY. They are deliberately NOT
-- passed into the video analyst's prompt — and neither is `filename`. The
-- filenames alone (`lane_block_byobject`, `agv_halfway_down`,
-- `electricty_faulty`) state the answer, which is exactly the leak you asked to
-- remove from raw_alerts.message. A model told "this clip shows a blocked lane"
-- reports a blocked lane whether or not one is visible. The analyst is given the
-- location and nothing else, so its reading is independent evidence the
-- orchestrator can weigh against the telemetry.
-- ---------------------------------------------------------------------------
update public.videos set description = 'Lane 7 mainline camera, AGV stopped mid-lane'
where filename = 'agv_halfway_down.mp4' and description is null;

update public.videos set description = 'Lane 7 mainline camera, obstruction in the running lane'
where filename = 'lane_block_byobject.mp4' and description is null;

update public.videos set description = 'BCSS-02 switchgear cabinet during the charging fault'
where filename = 'electricty_faulty.mp4' and description is null;

-- ---------------------------------------------------------------------------
-- Which incidents currently pick up footage:
--
--   select c.cluster_id, c.problem_type, count(distinct a.video_id) as clips
--   from public.incident_clusters_v2 c
--   join public.raw_alerts a
--     on c.raw_alert_ids ? a.id
--   where a.video_id is not null
--   group by c.cluster_id, c.problem_type
--   order by clips desc;
--
-- To attach a clip to more alerts:
--   update public.raw_alerts set video_id = '<videos.id>' where id in ('ALT-0xx', ...);
-- ---------------------------------------------------------------------------
