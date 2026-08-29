"""
Runs Stage 1 open clustering over the live raw_alerts stream and prints what
it found. Optionally writes the result to the v2 tables.

Usage (from backend/, inside the venv):
    python scripts/run_stage1.py                     # preview only, writes nothing
    python scripts/run_stage1.py --persist           # replace v2 tables with this run
    python scripts/run_stage1.py --persist --append  # keep earlier runs alongside
    python scripts/run_stage1.py --legacy-mode       # old purely spatio-temporal clustering
    python scripts/run_stage1.py --temporal-window 60 --spatial-window 40

Reading raw_alerts and agv_telemetry is read-only. Only --persist writes, and
it only ever writes to incident_clusters_v2 / safety_escalations /
stage1_runs — never to the original incident_clusters table.
"""

import argparse
import logging
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from agent.stage1_pipeline import fetch_raw_inputs, persist, run_stage1  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Stage 1 open clustering against Supabase")
    parser.add_argument("--persist", action="store_true", help="Write the result to the v2 tables")
    parser.add_argument(
        "--append",
        action="store_true",
        help="With --persist, keep previous runs instead of replacing them",
    )
    parser.add_argument(
        "--legacy-mode",
        action="store_true",
        help="Disable the problem-type gate (old purely spatio-temporal clustering)",
    )
    parser.add_argument("--temporal-window", type=float, default=None, help="Seconds")
    parser.add_argument("--spatial-window", type=float, default=None, help="Metres")
    parser.add_argument(
        "--no-filter-noise", action="store_true", help="Keep INFO/nominal noise alerts"
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    config = {}
    if args.legacy_mode:
        config["group_by_problem_type"] = False
    if args.temporal_window is not None:
        config["temporal_window_s"] = args.temporal_window
    if args.spatial_window is not None:
        config["spatial_window_m"] = args.spatial_window

    raw_alerts, telemetry = fetch_raw_inputs()
    result = run_stage1(
        raw_alerts, telemetry, config=config, filter_noise=not args.no_filter_noise
    )

    stats = result["stats"]
    print("\n" + "=" * 78)
    print(f" STAGE 1 - {stats['incidents']} incidents from {stats['ingested']} raw alerts")
    print("=" * 78)
    print(
        f" noise filtered: {stats['noiseFiltered']}   "
        f"singletons: {stats['singletonIncidents']}   "
        f"safety escalations: {stats['safetyEscalations']}"
    )
    print(f" problem types : {stats['problemTypeMix']}\n")

    for cluster in result["clusters"]:
        flag = " [SINGLETON]" if cluster["isSingleton"] else ""
        print(
            f"{cluster['incidentId']}  score={cluster['suggestedPriority']['score']:.2f}  "
            f"{cluster['problemType']}{flag}"
        )
        print(f"    {cluster['name']}")
        print(f"    agent  : {cluster['assignedAgent']}  ({cluster['domain']})")
        print(f"    alerts : {', '.join(cluster['clustering']['memberAlertIds'])}")
        print(f"    reasons: {', '.join(cluster['suggestedPriority']['reasonCodes'][:4])}")
        print()

    for escalation in result["escalations"]:
        print(
            f"{escalation['escalationId']}  SAFETY  {escalation['vehicleId']}  "
            f"{escalation['errorCode']}  (from {escalation['sourceAlertId']})"
        )

    if args.persist:
        outcome = persist(result, raw_alerts, config=config, replace=not args.append)
        print(
            f"\nWrote run {outcome['run_id']}: {outcome['clusters']} clusters, "
            f"{outcome['escalations']} escalations "
            f"({'replaced' if not args.append else 'appended'})."
        )
    else:
        print("\nPreview only — nothing written. Add --persist to write to the v2 tables.")


if __name__ == "__main__":
    main()
