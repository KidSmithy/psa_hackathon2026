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
| `sql/002_open_clustering.sql` | **New.** DDL for the v2 tables. |

---

## Step by step

### 0. One-time: create the new Supabase tables

Open the Supabase SQL Editor and run `backend/sql/002_open_clustering.sql`.

It creates three tables and touches nothing that already exists:

- `stage1_runs` — one row per algorithm run (config + stats)
- `incident_clusters_v2` — the incidents (first five columns identical to v1)
- `safety_escalations` — safety-channel alerts, which bypass scoring entirely

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
