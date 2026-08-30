"""
Generates a portable SQL seed file for the v2 tables from a real Stage 1 run.

Same output as `python scripts/run_stage1.py --persist`, except it emits SQL you
can paste into the Supabase SQL Editor instead of writing over the network. Use
it when you want the seed committed to the repo, reviewable in a diff, and
runnable by someone who has not set up the Python environment.

Usage (from backend/, inside the venv):
    python scripts/export_stage1_sql.py                      # -> sql/003_seed_incident_clusters_v2.sql
    python scripts/export_stage1_sql.py --out somewhere.sql
    python scripts/export_stage1_sql.py --source offline     # bundled replica of the 25 seeded rows
    python scripts/export_stage1_sql.py --legacy-mode        # spatio-temporal clustering instead

    # Scale demo: generate mock alerts AND the incidents derived from them.
    python scripts/export_stage1_sql.py --source mock --count 240 \
        --include-raw-alerts --run-id RUN-SCALE-0001 \
        --out sql/004_seed_scale_demo.sql

Sources:
    supabase  (default) the live raw_alerts table, read-only; falls back to
              `offline` if the database is unreachable
    offline   the bundled replica of the 25 seeded raw_alerts rows
    mock      freshly generated alerts from scripts/mock_alerts.py — these do
              not exist in the database, so pair this with --include-raw-alerts
              or the incidents will reference alert ids that are not there

Nothing is written to any database — only to the output file.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from agent.stage1_pipeline import (  # noqa: E402
    run_stage1,
    to_cluster_row,
    to_escalation_row,
)

DEFAULT_OUT = BACKEND_DIR / "sql" / "003_seed_incident_clusters_v2.sql"
SEED_RUN_ID = "RUN-SEED-0001"


def sql_literal(value: Any) -> str:
    """Renders a Python value as a Postgres literal."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, (dict, list)):
        return quote(json.dumps(value, separators=(",", ":"))) + "::jsonb"
    return quote(str(value))


def quote(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"


def insert_statement(table: str, rows: list[dict[str, Any]], pk: str) -> str:
    """
    One multi-row INSERT with an upsert clause, so the file can be re-run
    without erroring on rows that already exist.
    """
    if not rows:
        return f"-- no rows for {table}\n"

    columns = list(rows[0].keys())
    # Identifiers are double-quoted because raw_alerts has a column literally
    # named `timestamp`; quoting sidesteps any argument about which keywords
    # Postgres accepts bare in a column list.
    quoted = [f'"{c}"' for c in columns]
    updates = ", ".join(f'"{c}" = excluded."{c}"' for c in columns if c != pk)
    values = ",\n    ".join(
        "(" + ", ".join(sql_literal(row[c]) for c in columns) + ")" for row in rows
    )
    return (
        f"insert into public.{table}\n"
        f"    ({', '.join(quoted)})\n"
        f"values\n    {values}\n"
        f'on conflict ("{pk}") do update set {updates};\n'
    )


def load_alerts(args: argparse.Namespace) -> tuple[list[dict[str, Any]], list[dict[str, Any]], str]:
    if args.source == "mock":
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from mock_alerts import generate

        alerts = generate(
            count=args.count,
            seed=args.seed,
            start=args.start,
            span_minutes=args.span_minutes,
            id_prefix=args.id_prefix,
        )
        return alerts, [], f"generated mock stream ({len(alerts)} alerts, seed {args.seed})"

    if args.source == "supabase":
        try:
            from agent.stage1_pipeline import fetch_raw_inputs

            alerts, telemetry = fetch_raw_inputs()
            if alerts:
                return alerts, telemetry, "live Supabase raw_alerts"
            print("[warn] raw_alerts is empty; falling back to the offline replica.")
        except Exception as exc:
            print(f"[warn] Supabase unavailable ({exc}); falling back to the offline replica.")

    from test_clustering import get_fallback_supabase_mock_data

    alerts, telemetry, _ = get_fallback_supabase_mock_data()
    return alerts, telemetry, "offline replica of the 25 seeded raw_alerts rows"


def main() -> None:
    parser = argparse.ArgumentParser(description="Export a Stage 1 run as a SQL seed file")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="Output .sql path")
    parser.add_argument(
        "--source",
        choices=["supabase", "offline", "mock"],
        default="supabase",
        help="Where the alerts come from (default: supabase, falling back to offline)",
    )
    parser.add_argument(
        "--include-raw-alerts",
        action="store_true",
        help="Also emit INSERTs for the alerts themselves — required with --source mock",
    )
    parser.add_argument("--count", type=int, default=240, help="Mock alerts to generate")
    parser.add_argument("--seed", type=int, default=7, help="Mock generator seed")
    parser.add_argument("--start", default="2026-08-24T08:00:00Z", help="Mock stream start time")
    parser.add_argument("--span-minutes", type=int, default=45, help="Mock stream duration")
    parser.add_argument(
        "--id-prefix",
        default="ALT-1",
        help="Prefix for generated alert ids; keeps them clear of the seeded ALT-0xx rows",
    )
    parser.add_argument(
        "--legacy-mode", action="store_true", help="Disable the problem-type gate"
    )
    parser.add_argument("--temporal-window", type=float, default=None)
    parser.add_argument("--spatial-window", type=float, default=None)
    parser.add_argument(
        "--run-id", default=SEED_RUN_ID, help=f"run_id stamped on every row (default {SEED_RUN_ID})"
    )
    args = parser.parse_args()

    config: dict[str, Any] = {}
    if args.legacy_mode:
        config["group_by_problem_type"] = False
    if args.temporal_window is not None:
        config["temporal_window_s"] = args.temporal_window
    if args.spatial_window is not None:
        config["spatial_window_m"] = args.spatial_window

    raw_alerts, telemetry, source_label = load_alerts(args)
    if args.source == "mock" and not args.include_raw_alerts:
        print(
            "[warn] --source mock without --include-raw-alerts: the incidents will "
            "reference alert ids that do not exist in the database."
        )
    result = run_stage1(raw_alerts, telemetry, config=config)

    raw_by_id = {str(r.get("id")): r for r in raw_alerts}
    cluster_rows = [to_cluster_row(c, raw_by_id, args.run_id) for c in result["clusters"]]
    escalation_rows = [to_escalation_row(e, args.run_id) for e in result["escalations"]]
    run_row = {
        "run_id": args.run_id,
        "config": config,
        "stats": result["stats"],
        "noise_alert_ids": [str(n.get("id")) for n in result["noise"]],
    }

    stats = result["stats"]
    header = f"""-- ============================================================================
-- Seed data for the Stage 1 v2 tables.
--
-- GENERATED FILE — produced by `python scripts/export_stage1_sql.py`. Edit the
-- algorithm or the alert data and regenerate rather than hand-editing rows.
--
--   source          : {source_label}
--   alerts ingested : {stats['ingested']} ({stats['noiseFiltered']} filtered as noise)
--   incidents       : {stats['incidents']} ({stats['singletonIncidents']} singletons)
--   escalations     : {stats['safetyEscalations']}
--   problem types   : {stats['problemTypeMix']}
--
-- Run backend/sql/002_open_clustering.sql first — this file assumes the tables
-- exist. Re-running is safe: every statement upserts on its primary key.
--
-- public.incident_clusters (v1, the hand-seeded CLUSTER-A..D rows) is not
-- referenced anywhere in this file and is left exactly as it is.
-- ============================================================================

begin;

-- Clear any previous seed so re-running gives a clean, coherent picture rather
-- than mixing this run with an earlier one. Rows from other runs are untouched.
delete from public.incident_clusters_v2 where run_id = {quote(args.run_id)};
delete from public.safety_escalations   where run_id = {quote(args.run_id)};

"""

    id_like = f"{args.id_prefix}%"
    sections: list[str] = []

    if args.include_raw_alerts:
        sections += [
            "-- ---- the alerts these incidents were derived from -----------------------",
            "-- Added alongside whatever raw_alerts already holds. Every id here starts",
            f"-- with '{args.id_prefix}', so the originals (ALT-001..ALT-025) cannot collide",
            f"-- with them and `where id like '{id_like}'` removes exactly this batch.",
            insert_statement("raw_alerts", raw_alerts, "id"),
            "",
        ]

    sections += [
        "-- ---- the Stage 1 run this data came from --------------------------------",
        insert_statement("stage1_runs", [run_row], "run_id"),
        "",
        "-- ---- incidents ----------------------------------------------------------",
        insert_statement("incident_clusters_v2", cluster_rows, "cluster_id"),
        "",
        "-- ---- safety-channel escalations -----------------------------------------",
        insert_statement("safety_escalations", escalation_rows, "escalation_id"),
    ]
    body = "\n".join(sections)

    rollback = (
        f"--   delete from public.raw_alerts where id like '{id_like}';\n"
        if args.include_raw_alerts
        else ""
    )
    footer = f"""
commit;

-- Check what landed:
--   select cluster_id, problem_type, is_singleton, assigned_agent,
--          suggested_priority->>'score' as score, name
--   from public.incident_clusters_v2
--   order by (suggested_priority->>'score')::numeric desc;
--
-- Undo this seed entirely:
--   delete from public.incident_clusters_v2 where run_id = {quote(args.run_id)};
--   delete from public.safety_escalations   where run_id = {quote(args.run_id)};
--   delete from public.stage1_runs          where run_id = {quote(args.run_id)};
{rollback}"""

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(header + body + footer, encoding="utf-8")

    print(f"Wrote {out_path}")
    print(
        f"  {len(cluster_rows)} incidents, {len(escalation_rows)} escalations, "
        f"run_id {args.run_id}, source: {source_label}"
    )


if __name__ == "__main__":
    main()
