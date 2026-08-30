# Stage 1 Open Clustering — what changed and how to run it

## The change in one paragraph

The agent pipeline used to read four hand-labelled rows (`CLUSTER-A`..`CLUSTER-D`)
out of the `incident_clusters` table, and route each one to an investigator via a
hardcoded `cluster id -> agent` map. It now runs the real Stage 1 algorithm over
the live `raw_alerts` stream and gets back **however many incidents the data
actually contains**. Alerts group together only when they describe the *same kind
of problem* as well as being close in space and time; anything that correlates
with nothing comes back as a **single-alert incident** rather than being absorbed
by whatever happened to be nearby. Routing is derived from each incident's
problem type, so an incident nobody enumerated in advance still reaches an
investigator.

Nothing was deleted. `incident_clusters` is untouched and one env var switches
back to it.

---

## What open clustering produces

On the 25 seeded `raw_alerts` rows, the old fixed set of 4 clusters becomes
7 incidents (2 of them singletons):

| Incident | Problem type | Alerts | Routed to |
|---|---|---|---|
| Lane 7 mainline — Traffic Flow Blockage | `TRAFFIC_FLOW` | ALT-001, 003, 004, 005, 008 | `lane_investigator` |
| Sector A staging buffer — Fleet Battery Starvation | `FLEET_BATTERY` | ALT-016..019 | `fleet_power_investigator` |
| Lane 4 transfer corridor — Perception / Safety Stop | `PERCEPTION_SAFETY` | ALT-020, 022 | `lane_investigator` |
| BCSS Charger B3 — Charging Station Power Fault | `POWER_CHARGING` | ALT-009..015 | `power_investigator` |
| Lane 7 mainline — Mechanical / Actuator Fault | `MECHANICAL_ACTUATOR` | ALT-002, 007 | `lane_investigator` |
| Lane 7 mainline — Crane Handoff Disruption *(single alert)* | `CRANE_HANDOFF` | ALT-006 | `lane_investigator` |
| Lane 4 transfer corridor — Traffic Flow Blockage *(single alert)* | `TRAFFIC_FLOW` | ALT-021 | `lane_investigator` |

The old `CLUSTER-A` "Lane 7 Bottleneck" was three different problems in one box:
a traffic queue, a twistlock actuator fault, and a starved quay crane. Open
clustering separates them, which is what lets three specialist investigations run
instead of one generic one.

---

## Files

| File | Role |
|---|---|
| `clustering/problem_types.py` | **New.** Problem-type taxonomy, classification, and problem-type → investigator routing. |
| `clustering/filter.py` | Problem-type gate added to the neighbourhood predicate; incidents now carry `name`, `problemType`, `domain`, `assignedAgent`, `isSingleton`. |
| `agent/stage1_pipeline.py` | **New.** raw_alerts → normalize → cluster → graph-shaped incidents; also row shaping and persistence. |
| `agent/stage1_bridge.py` | Chooses the Stage 1 source (`live` or `table`) and returns one shape either way. |
| `agent/coordinator.py` | Routes on `domain` (from problem type) instead of a cluster-id map. |
| `agent/investigators/general.py` | **New.** Catch-all investigator for incidents no specialist owns. |
| `agent/server.py` | Added `GET /api/stage1`, `POST /api/stage1/persist`; fixed a missing import that made `/api/investigate` fail at request time. |
| `scripts/run_stage1.py` | **New.** CLI to preview or persist a Stage 1 run. |
| `scripts/export_stage1_sql.py` | **New.** Emits a Stage 1 run as a portable `.sql` seed file. |
| `scripts/mock_alerts.py` | **New.** Generates `raw_alerts` rows in the seeded style, as correlated episodes plus singletons plus noise. |
| `sql/002_open_clustering.sql` | **New.** DDL for the v2 tables. |
| `sql/003_seed_incident_clusters_v2.sql` | **New, generated.** The 7 incidents derived from your existing 25 alerts. |
| `sql/004_seed_scale_demo.sql` | **New, generated.** 240 mock alerts + 53 incidents, for testing at scale. |
| `frontend/src/components/IncidentTimeRibbon.tsx` | Rewritten as one unified timeline — no per-cluster rows. |
| `frontend/src/lib/supabase.ts` | Exports `CLUSTERS_TABLE`, driven by `VITE_CLUSTERS_TABLE`. |

---

## Step by step

### 0. One-time: create the new Supabase tables

In the Supabase SQL Editor, run the files in `backend/sql/` in order:

| File | What it does | Required? |
|---|---|---|
| `002_open_clustering.sql` | Creates `stage1_runs`, `incident_clusters_v2`, `safety_escalations` | Yes |
| `003_seed_incident_clusters_v2.sql` | Seeds the 7 incidents the algorithm derives from your existing 25 `raw_alerts` | Yes, to have data |
| `004_seed_scale_demo.sql` | Optional: adds 240 mock alerts (ids `ALT-1xxx`) plus the 53 incidents derived from them | Only for testing at scale |

None of them touch `raw_alerts`' existing rows or `incident_clusters`.
`003` inserts incidents only — it references the `ALT-001`..`ALT-025` rows you
already have. `004` is the one that adds alerts, and every id it adds starts
with `ALT-1`, so it cannot collide with the originals.

Every statement upserts on its primary key, so re-running a file is safe. Each
file ends with the exact `delete` statements that undo it.

### 1. Backend env

`backend/.env` — add one line to the existing file:

```env
STAGE1_SOURCE=live      # 'live' = run the algorithm; 'table' = old CLUSTER-A..D rows
```

`live` is the default if the variable is absent.

### 2. Preview the clustering — no LLM, no writes

```bash
cd backend
.\venv\Scripts\Activate.ps1          # macOS/Linux: source venv/bin/activate
python scripts/run_stage1.py
```

Prints every incident, its problem type, its score, and which investigator owns
it. Reads `raw_alerts` and `agv_telemetry`; writes nothing.

Useful variants:

```bash
python scripts/run_stage1.py --legacy-mode            # old purely spatio-temporal clustering
python scripts/run_stage1.py --temporal-window 60     # tighter grouping
python scripts/run_stage1.py --no-filter-noise        # keep INFO/nominal alerts
```

### 3. Write the result to Supabase

```bash
python scripts/run_stage1.py --persist
```

Replaces the contents of the v2 tables with this run. `--persist --append`
keeps earlier runs alongside it — every row carries the `run_id` that produced
it, so history stays queryable either way. `incident_clusters` is never written
to.

### 3b. Regenerating the seed files

The `.sql` files are generated from a real algorithm run, not hand-written:

```bash
# 003 — incidents from whatever is in raw_alerts right now
python scripts/export_stage1_sql.py

# 004 — mock alerts plus the incidents they produce
python scripts/export_stage1_sql.py --source mock --count 240 \
    --include-raw-alerts --run-id RUN-SCALE-0001 \
    --out sql/004_seed_scale_demo.sql
```

`scripts/mock_alerts.py` is the generator behind `--source mock`. It emits rows
in your exact `raw_alerts` shape, using only alert types and asset ids that
already exist in the database, so an investigator's MCP tool calls still
resolve. Alerts come out as *episodes* — bursts that should correlate — mixed
with lone alerts that should stay singletons and INFO noise that gets filtered,
which is what makes the clustering output realistic rather than 240 singletons.

Deterministic: same `--seed`, same alerts. Change `--count`, `--span-minutes`
or `--seed` and regenerate to get a different-shaped stream.

### 3c. Switching the app over to v2

Three places, none of which require touching component code:

| Where | Change | Effect |
|---|---|---|
| `backend/.env` | `STAGE1_SOURCE=live` | The agent pipeline clusters `raw_alerts` itself instead of reading v1 rows |
| `frontend/.env` | `VITE_CLUSTERS_TABLE=incident_clusters_v2` | The UI reads the generated incidents |
| Supabase | run `002` + `003` | The v2 tables exist and have data |

To go back to the original demo, set `STAGE1_SOURCE=table` and
`VITE_CLUSTERS_TABLE=incident_clusters` (or just delete both lines — those are
the defaults for v1 behaviour). Nothing in v1 was modified, so the rollback is
complete.

`frontend/src/App.tsx` reads the table name from `CLUSTERS_TABLE` in
`src/lib/supabase.ts` and passes the rows down as props, so every page —
alerts, yard map, timeline — follows automatically.

### 4. Run the agent pipeline over the live clusters

```bash
python -m agent.run                                   # every incident
python -m agent.run --incident INC-2026-0823-0001     # just one
python -m agent.run --source table                    # the old CLUSTER-A..D demo
```

This is the LLM step — it needs `OPENAI_API_KEY` and spawns the MCP servers.

### 5. Start the API

```bash
uvicorn agent.server:app --reload --port 8000
```

| Endpoint | What it does |
|---|---|
| `GET /api/health` | Reports the active `stage1Source` |
| `GET /api/stage1` | Runs clustering, returns the incidents. No LLM, no writes. |
| `POST /api/stage1/persist` | Runs clustering and writes to the v2 tables |
| `POST /api/investigate` | Full investigation. Body: `{"cluster_id": null, "source": null}` |
| `GET /api/investigate/stream` | Same, as SSE. Query: `?cluster_id=...&source=...` |

Quick check:

```bash
curl http://localhost:8000/api/stage1
```

### 6. Point the frontend at the new incidents

`frontend/.env`:

```env
VITE_CLUSTERS_TABLE=incident_clusters_v2
```

Then `npm run dev`. Leave it unset (or set to `incident_clusters`) to show the
original demo — the UI code is identical for both, because the five columns it
reads are the same.

---

## The unified timeline

The old ribbon gave every incident its own horizontal lane, so its height was
`44px x incident count`. That works for four hand-labelled clusters and breaks
immediately under open clustering — 240 mock alerts produce 53 incidents, and
the 200-alert PSA-Sprint bulk stream produces 80. It also implied a grouping
that no longer means anything: with hundreds of incidents, one row per incident
is not a view, it is a list with extra steps.

`IncidentTimeRibbon` is now a single shared time axis at **fixed height
regardless of incident count**:

| Band | Shows | Why it scales |
|---|---|---|
| Density bars | How many incidents *started* in each of 60 time buckets, stacked by severity | A count per bucket stays readable at any volume; individual marks do not |
| Incident track | One marker per incident at its onset, with a line showing how long its alerts kept arriving | Diamond = correlated (2+ alerts), hollow circle = singleton |
| Alert strip | Every raw alert as a thin tick | Texture under the incidents — where the noise actually was |
| Bracket band | The 20s split rule, drawn **only for the selected incident** | The rule is still there; it just no longer costs a permanent row per incident |

Below the chart is a chronological chip strip, which is how you reach an
incident whose marker is buried in a busy stretch. Selection, the shared
scrubber, and safety-channel markers all work as before.

Nothing about the timeline assumes v1 or v2: `is_singleton` falls back to
"one alert" when the column is absent, so it renders the old `incident_clusters`
rows unchanged.

---

## The AI orchestrator pipeline

Routing is no longer a lookup. The graph now runs:

```
START -> video_analysis -> orchestrator -> (fan out by domain)
                                             |
    [lane | power | fleet_power | general]_investigator
                                             |
                          aggregator -> correlation -> submit_docket -> END
```

| Stage | File | What it does |
|---|---|---|
| `video_analysis` | `agent/video_analyst.py` | Gemini 3.7 Flash reads the CCTV clip attached to an incident. Runs **first**, so what the camera saw is an input to routing rather than something discovered afterwards. |
| `orchestrator` | `agent/orchestrator.py` | LLM. Decides which specialist(s) each incident needs — **one, two or three** — weighing the video finding against the telemetry. |
| investigators | `agent/investigators/*.py` | Unchanged in kind, but each now receives a `focus`: the specific question the orchestrator wants it to answer. Two agents on one incident differ by `focus`, which is the whole reason for assigning both. |
| `aggregator` | `agent/aggregator.py` | Fans N findings per incident back in to exactly one, surfacing disagreements rather than silently picking a winner. |

Every layer states its JSON contract in its own system prompt (`FINDING_CONTRACT`,
`ASSIGNMENT_CONTRACT`, `MERGED_CONTRACT`, `VIDEO_FINDING_CONTRACT`) and enforces
it with structured output, so the prompt is readable documentation and a chatty
model still parses.

**Multi-agent assignment** was the reason the aggregator had to exist:
`DOCKET-{incident_id}` collides the moment one incident produces two findings.
Correlation, the docket and the API now all read `aggregated_findings`, which is
one entry per incident, and fall back to the raw list if the aggregator is ever
skipped.

**Everything fails soft.** No `GEMINI_API_KEY`, no CCTV rules, no matching clip,
or a failed upload → no video finding, and the orchestrator decides on telemetry
alone. An orchestrator error or an unknown domain in its response → deterministic
fallback routing, because a dropped incident is worse than a generically-routed
one.

---

## Why the agents never see `raw_alerts.message`

The seeded messages state the diagnosis outright — *"Twistlock release actuator
timed out"*, *"Pressure reached 275 bar limit"*, *"Busbar temperature exceeded
80.0C threshold"*. An agent handed those is paraphrasing an answer, not deriving
one, and the pipeline would look far more capable than it is.

`agent/facts.py` is the single projection from an incident to what a model may
see. It is a **whitelist** (`id`, `timestamp`, `source`, `type`, `location`,
`severity`), so a column added to `raw_alerts` later is excluded by default
rather than included by accident. `assert_no_leaked_message()` is the assertion
to use in tests.

The clustering side no longer reads the column either: `adapter.py` derives
vehicle, crane and safety-channel from `source`/`type`/`location`, and
`problem_types.py` classifies from fault codes and `source`. **Verified: the
clustering output is byte-identical with and without the column** — same 7
incidents, same groupings, same routing.

To actually drop it, run `sql/006_drop_raw_alert_message.sql`. It archives the
text to `raw_alerts_message_archive` first and includes the restore statement.
The frontend was made to tolerate its absence: `message` is optional on
`RawAlert` and every read goes through `alertText()`, which falls back to a
humanised alert type. Those pages will look emptier, not broken.

---

## Video analysis

`sql/005_cctv_videos.sql` creates the `cctv_videos` lookup — one row per clip,
matched to an incident by `location` plus optional `problem_types`. Rules naming
a problem type beat catch-all rules for the same location. You can equally
hardcode clips in `FOOTAGE_RULES` in `agent/cctv.py` without a database.

Setup:

```env
GEMINI_API_KEY=...            # backend/.env; without it the stage is skipped
GEMINI_MODEL=gemini-3.7-flash # default
CCTV_ROOT=<dir>               # default backend/video/, where relative uris resolve
```

`pip install -r requirements.txt` again — `google-genai` was added.

One deliberate choice: the video analyst is told the **location and nothing
else**. Not the fault type, not the alert types, not even the clip's own
`description`. A model told "this is a twistlock failure" will report a twistlock
failure whether or not one is visible; the value of this stage is an independent
observation the orchestrator can weigh *against* the telemetry. It is also told
to answer `UNUSABLE_FOOTAGE` rather than invent an event, and investigators are
told to treat its output as an observation to corroborate, not as fact.

---

## Where the triage agent plugs in

*(Historical — this is now implemented; see "The AI orchestrator pipeline"
above. Kept because the seam it describes is still how routing is overridden.)*

The decision is data on the incident, not code:

- `agent/coordinator.py`'s `resolve_domain()` prefers `cluster["domain"]` and
  only falls back to the map when it is missing. An agent that sets `domain`
  (and `assigned_agent`) before fan-out overrides the default silently.
- The `coordinator` node itself is still a pass-through and exists precisely so
  a decision step has somewhere to live between "Stage 1 produced incidents" and
  "fan out to investigators".
- `incident_clusters_v2` already has `assigned_domain` and `assigned_agent`
  columns for it to write to, plus `problem_type` and `suggested_priority` as
  inputs to reason over.

The deterministic map stays useful as the fallback for when the agent is
unavailable or unsure, and as the thing to diff its choices against.

---

## Tuning

Config keys accepted by `run_clustering(alerts, config=...)`,
`scripts/run_stage1.py`, and `test_clustering.py`:

| Key | Open-mode default | Effect |
|---|---|---|
| `group_by_problem_type` | `True` | The whole feature. `False` restores the old behaviour exactly. |
| `temporal_window_s` | `180.0` | How far apart two same-type alerts can be and still group. Legacy mode: `20.0`. |
| `spatial_window_m` | `40.0` | Distance threshold before topology adjacency is tried. |
| `topology_max_hops` | `1` | How far apart on the yard graph two resources can be and still count as connected. |
| `max_cluster_dwell_s` | `900.0` | Chain guard: splits a group spanning longer than this. Legacy mode: `300.0`. |
| `max_cluster_alerts` | `12` | Chain guard: splits a group larger than this at its widest time gap. |

The time windows widen in open mode because the type gate now does the
separating — a lane jam and a charger trip 30 seconds apart no longer merge no
matter how wide the window is. Explicit values always win over these defaults.

**More singletons than you want?** Raise `temporal_window_s`, or add the alert
type to `TYPE_TO_FAMILY` in `clustering/problem_types.py` if it is landing in
`UNCLASSIFIED`.

**Two problems still merging?** They share a family. Split the family, or move
one of the two types to a family of its own.

---

## Adding a problem type

Everything lives in `clustering/problem_types.py`:

1. Add the alert type to `TYPE_TO_FAMILY` (or a keyword to `KEYWORD_RULES` if
   the fault code varies).
2. If it needs a new family: declare the constant, add it to `PROBLEM_TYPES`,
   give it a `PROBLEM_TYPE_LABEL`, and map it in `DOMAIN_OF_PROBLEM_TYPE`.
3. If it needs a new investigator, add a module under `agent/investigators/`
   and register it in `agent/graph.py`'s `domain_nodes`.

An unmapped type is not an error — it classifies as `UNCLASSIFIED`, stays a
singleton, and routes to the general investigator.
