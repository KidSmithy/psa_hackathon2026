"""
Test Script: Stage 1 Alert Clustering on Current PSA Port Terminal Alerts.

Usage:
    # 1. Test clustering on live Supabase raw_alerts (STRICTLY READ-ONLY)
    python test_clustering.py --source supabase

    # 2. Test clustering with noise filtering enabled
    python test_clustering.py --source supabase --filter-noise

    # 3. Test clustering on PSA-Sprint curated scenarios
    python test_clustering.py --source curated

    # 4. Test clustering on PSA-Sprint bulk stream (200 alerts)
    python test_clustering.py --source bulk

    # 5. Save output bundle to local file for review
    python test_clustering.py --source supabase --out clustering/out/test_clusters.json
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Ensure Python path includes backend directory
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Force UTF-8 output encoding on Windows terminals
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from clustering import (
    CLUSTERING_METHOD,
    SCHEMA_VERSION,
    is_noise_alert,
    normalize_alert_batch,
    run_clustering,
    yard,
)


def load_from_supabase() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    STRICTLY READ-ONLY: Fetches raw_alerts, agv_telemetry, and existing incident_clusters
    from Supabase PostgreSQL database.
    """
    print("\n[DB] Connecting to Supabase (READ-ONLY)...")
    try:
        from mcp.supabase_client import get_supabase_client
        client = get_supabase_client()
    except Exception as e:
        print(f"[WARN] Supabase client initialization failed: {e}")
        print("[INFO] Falling back to local offline mock alerts representing current database state.")
        return get_fallback_supabase_mock_data()

    try:
        # 1. Fetch raw_alerts (READ-ONLY)
        raw_res = client.table("raw_alerts").select("*").order("timestamp").execute()
        raw_alerts = raw_res.data or []
        print(f"[OK] Fetched {len(raw_alerts)} raw alerts from 'raw_alerts' table.")

        # 2. Fetch agv_telemetry (READ-ONLY)
        tel_res = client.table("agv_telemetry").select("*").execute()
        telemetry = tel_res.data or []
        print(f"[OK] Fetched {len(telemetry)} telemetry records from 'agv_telemetry' table.")

        # 3. Fetch existing incident_clusters for comparison (READ-ONLY)
        inc_res = client.table("incident_clusters").select("*").execute()
        existing_clusters = inc_res.data or []
        print(f"[OK] Fetched {len(existing_clusters)} existing reference clusters from 'incident_clusters' table.")

        return raw_alerts, telemetry, existing_clusters
    except Exception as e:
        print(f"[ERROR] Failed to query Supabase tables: {e}")
        print("[INFO] Falling back to local offline mock alerts representing current database state.")
        return get_fallback_supabase_mock_data()


def get_fallback_supabase_mock_data() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Seeded replica of the 25 Supabase raw_alerts rows for offline or fallback execution."""
    raw_alerts = [
        {"id": "ALT-023", "timestamp": "2026-08-23 19:00:00+00", "source": "WEATHER_STATION_01", "type": "WIND_GUST_ADVISORY", "location": "Terminal_Wide", "severity": "INFO", "message": "Wind speed 14 m/s (below 20 m/s crane cutoff)"},
        {"id": "ALT-001", "timestamp": "2026-08-23 19:00:02+00", "source": "LANE_7_ENTRY_DETECTOR", "type": "TRAFFIC_CONGESTION", "location": "Lane_7", "severity": "HIGH", "message": "Traffic stopped for > 90s"},
        {"id": "ALT-002", "timestamp": "2026-08-23 19:00:05+00", "source": "AGV-104", "type": "TWISTLOCK_TIMEOUT", "location": "Lane_7", "severity": "CRITICAL", "message": "Twistlock release actuator timed out"},
        {"id": "ALT-003", "timestamp": "2026-08-23 19:00:09+00", "source": "AGV-109", "type": "OBSTACLE_PROXIMITY", "location": "Lane_7", "severity": "MEDIUM", "message": "Obstacle detected within 1.5m safety zone"},
        {"id": "ALT-009", "timestamp": "2026-08-23 19:00:10+00", "source": "BCSS-02", "type": "BREAKER_TRIPPED", "location": "Station_BCSS_02", "severity": "CRITICAL", "message": "Main charging circuit breaker tripped"},
        {"id": "ALT-004", "timestamp": "2026-08-23 19:00:14+00", "source": "AGV-112", "type": "OBSTACLE_PROXIMITY", "location": "Lane_7", "severity": "MEDIUM", "message": "Obstacle detected within 1.5m safety zone"},
        {"id": "ALT-010", "timestamp": "2026-08-23 19:00:15+00", "source": "BCSS-02", "type": "OVERTEMP_WARNING", "location": "Station_BCSS_02", "severity": "HIGH", "message": "Busbar temperature exceeded 80.0C threshold"},
        {"id": "ALT-011", "timestamp": "2026-08-23 19:00:20+00", "source": "BCSS-02", "type": "VOLTAGE_DROP", "location": "Station_BCSS_02", "severity": "HIGH", "message": "Charging bus voltage dropped to 0V"},
        {"id": "ALT-016", "timestamp": "2026-08-23 19:00:30+00", "source": "AGV-088", "type": "BATTERY_LOW_CRITICAL", "location": "Station_BCSS_02", "severity": "CRITICAL", "message": "Battery SoC dropped below 15% (current: 11.8%)"},
        {"id": "ALT-017", "timestamp": "2026-08-23 19:00:42+00", "source": "FLEET_MANAGER", "type": "REROUTE_FAIL", "location": "Sector_A", "severity": "HIGH", "message": "Unable to assign alternative charger: BCSS-01 at 100% capacity"},
        {"id": "ALT-005", "timestamp": "2026-08-23 19:00:45+00", "source": "LANE_7_FLOW_CTRL", "type": "HEADWAY_VIOLATION", "location": "Lane_7", "severity": "HIGH", "message": "Zero vehicle clearance detected in Lane 7"},
        {"id": "ALT-006", "timestamp": "2026-08-23 19:00:54+00", "source": "QC-03_DISPATCH", "type": "FEEDER_STARVATION", "location": "Lane_7", "severity": "HIGH", "message": "Quay crane QC-03 waiting for AGV-104 payload"},
        {"id": "ALT-024", "timestamp": "2026-08-23 19:01:00+00", "source": "QC-01", "type": "REEFER_TEMP_NORMAL", "location": "Berth_01", "severity": "INFO", "message": "Container monitoring report nominal for Reefer Block 2"},
        {"id": "ALT-012", "timestamp": "2026-08-23 19:01:00+00", "source": "BCSS-02", "type": "CHARGING_SESSION_ABORTED", "location": "Station_BCSS_02", "severity": "MEDIUM", "message": "Session interrupted for target vehicle AGV-088"},
        {"id": "ALT-013", "timestamp": "2026-08-23 19:01:05+00", "source": "BCSS_POWER_GRID", "type": "BUS_FAULT", "location": "Station_BCSS_02", "severity": "HIGH", "message": "Secondary sub-station load shedding triggered"},
        {"id": "ALT-014", "timestamp": "2026-08-23 19:01:10+00", "source": "BCSS-02", "type": "COOLING_LOOP_FAIL", "location": "Station_BCSS_02", "severity": "HIGH", "message": "Coolant flow sensor reported low delta-P"},
        {"id": "ALT-018", "timestamp": "2026-08-23 19:01:10+00", "source": "AGV-072", "type": "BATTERY_WARNING", "location": "Sector_A", "severity": "MEDIUM", "message": "Battery SoC below 22%, queued for charging"},
        {"id": "ALT-015", "timestamp": "2026-08-23 19:01:15+00", "source": "FLEET_ROUTER", "type": "CHARGER_UNAVAILABLE", "location": "Station_BCSS_02", "severity": "MEDIUM", "message": "BCSS-02 taken out of automated routing pool"},
        {"id": "ALT-019", "timestamp": "2026-08-23 19:01:25+00", "source": "DISPATCH_OPTIMIZER", "type": "DEADLOCK_RISK", "location": "Sector_A", "severity": "HIGH", "message": "3 AGVs entering critical battery threshold in next 15 mins"},
        {"id": "ALT-007", "timestamp": "2026-08-23 19:01:30+00", "source": "AGV-104", "type": "HYDRAULIC_HIGH_PRESSURE", "location": "Lane_7", "severity": "HIGH", "message": "Pressure reached 275 bar limit"},
        {"id": "ALT-008", "timestamp": "2026-08-23 19:01:40+00", "source": "LANE_7_ZONE_MONITOR", "type": "THROUGHPUT_DROP", "location": "Lane_7", "severity": "MEDIUM", "message": "Lane throughput reduced to 0 TEU/h"},
        {"id": "ALT-020", "timestamp": "2026-08-23 19:01:50+00", "source": "AGV-055", "type": "LIDAR_SAFETY_TRIP", "location": "Lane_4", "severity": "HIGH", "message": "Front safety LiDAR triggered emergency stop at 0.8m"},
        {"id": "ALT-021", "timestamp": "2026-08-23 19:01:58+00", "source": "LANE_4_MONITOR", "type": "UNEXPECTED_STOP", "location": "Lane_4", "severity": "MEDIUM", "message": "Vehicle AGV-055 stopped outside designated transfer slot"},
        {"id": "ALT-022", "timestamp": "2026-08-23 19:02:25+00", "source": "AGV-055", "type": "OPTICAL_OCCLUSION", "location": "Lane_4", "severity": "LOW", "message": "LiDAR sensor window optical transmittance degraded (dust/smudge)"},
        {"id": "ALT-025", "timestamp": "2026-08-23 19:02:30+00", "source": "BCSS-01", "type": "SESSION_COMPLETED", "location": "Station_BCSS_01", "severity": "INFO", "message": "AGV-201 charge cycle finished (94% SoC)"},
    ]
    telemetry = [
        {"vehicle_id": "AGV-104", "speed_mps": 0.0, "twistlock_sensor": "ENGAGED", "twistlock_command": "RELEASE", "hydraulic_pressure_bar": 275.0, "error_register": "SPREADER_LOCK_FAULT", "battery_soc_percent": 61.0, "load_state": "LOADED", "driving_state": "STOPPED", "wi_status": "PENDING_REJECTION"},
        {"vehicle_id": "AGV-109", "speed_mps": 0.0, "twistlock_sensor": "RELEASED", "twistlock_command": "NONE", "hydraulic_pressure_bar": 140.0, "error_register": "OK", "battery_soc_percent": 74.0, "load_state": "EMPTY", "driving_state": "WAITING", "wi_status": "BYPASSED"},
        {"vehicle_id": "AGV-112", "speed_mps": 0.0, "twistlock_sensor": "RELEASED", "twistlock_command": "NONE", "hydraulic_pressure_bar": 138.0, "error_register": "OK", "battery_soc_percent": 82.0, "load_state": "EMPTY", "driving_state": "WAITING", "wi_status": "BYPASSED"},
        {"vehicle_id": "AGV-088", "speed_mps": 0.0, "twistlock_sensor": "RELEASED", "twistlock_command": "NONE", "hydraulic_pressure_bar": 0.0, "error_register": "ERR_BMS_CRITICAL_SOC", "battery_soc_percent": 11.8, "load_state": "EMPTY", "driving_state": "STOPPED", "wi_status": "IN_PROGRESS"},
        {"vehicle_id": "AGV-055", "speed_mps": 0.0, "twistlock_sensor": "RELEASED", "twistlock_command": "NONE", "hydraulic_pressure_bar": 120.0, "error_register": "0x3A2", "battery_soc_percent": 66.0, "load_state": "EMPTY", "driving_state": "STOPPED", "protective_field_violation": True},
    ]
    existing = [
        {"cluster_id": "CLUSTER-A", "name": "Lane 7 Bottleneck", "raw_alert_ids": ["ALT-001", "ALT-002", "ALT-003", "ALT-004", "ALT-005", "ALT-006", "ALT-007", "ALT-008"]},
        {"cluster_id": "CLUSTER-B", "name": "BCSS-02 Charger Trip", "raw_alert_ids": ["ALT-009", "ALT-010", "ALT-011", "ALT-012", "ALT-013", "ALT-014", "ALT-015"]},
        {"cluster_id": "CLUSTER-C", "name": "Sector A Battery Starvation Risk", "raw_alert_ids": ["ALT-016", "ALT-017", "ALT-018", "ALT-019"]},
        {"cluster_id": "CLUSTER-D", "name": "Lane 4 Safety Stop (LiDAR Degraded)", "raw_alert_ids": ["ALT-020", "ALT-021", "ALT-022"]},
    ]
    return raw_alerts, telemetry, existing


def load_from_curated_file() -> Tuple[List[Dict[str, Any]], str]:
    """Loads curated scenarios from PSA-Sprint."""
    candidates = [
        BACKEND_DIR.parent / "PSA-Sprint" / "out" / "raw_alerts.json",
        BACKEND_DIR.parent / "PSA-Sprint" / "stage1_agv" / "stage1" / "out" / "raw_alerts.json",
    ]
    for path in candidates:
        if path.exists():
            payload = json.loads(path.read_text(encoding="utf-8"))
            alerts = payload.get("alerts", [])
            return alerts, str(path)
    # Generate on the fly if files not found
    try:
        sys.path.insert(0, str(BACKEND_DIR.parent / "PSA-Sprint"))
        import generate_alerts
        scenarios = generate_alerts.curated()
        alerts = []
        for _, _, grp in scenarios:
            alerts.extend(grp)
        return alerts, "PSA-Sprint::generate_alerts.curated()"
    except Exception as e:
        raise RuntimeError(f"Could not load curated scenarios: {e}")


def load_from_bulk_file() -> Tuple[List[Dict[str, Any]], str]:
    """Loads bulk 200 alert dataset from PSA-Sprint."""
    candidates = [
        BACKEND_DIR.parent / "PSA-Sprint" / "out" / "raw_alerts_bulk.json",
        BACKEND_DIR.parent / "PSA-Sprint" / "stage1_agv" / "stage1" / "out" / "raw_alerts_bulk.json",
    ]
    for path in candidates:
        if path.exists():
            payload = json.loads(path.read_text(encoding="utf-8"))
            alerts = payload.get("alerts", [])
            return alerts, str(path)
    # Generate bulk on the fly
    try:
        sys.path.insert(0, str(BACKEND_DIR.parent / "PSA-Sprint"))
        import generate_alerts
        alerts = generate_alerts.bulk(200, seed=7)
        return alerts, "PSA-Sprint::generate_alerts.bulk(200)"
    except Exception as e:
        raise RuntimeError(f"Could not load bulk stream: {e}")


def print_banner(title: str):
    print("\n" + "=" * 90)
    print(f" {title.upper()}")
    print("=" * 90)


def format_cluster_row(idx: int, c: Dict[str, Any]) -> str:
    inc_id = c["incidentId"]
    score = c["suggestedPriority"]["score"]
    reasons = ", ".join(c["suggestedPriority"]["reasonCodes"][:3])
    feature = c["location"]["nearestNamedFeature"]
    num_alerts = c["clustering"]["rawAlertCount"]
    vehicles = c["participatingVehicles"]
    lead = vehicles[0]["vehicleId"] if vehicles else "N/A"
    num_v = len(vehicles)
    refs_count = len(c.get("evidenceRefs", []))
    
    return (
        f"[{idx:02d}] {inc_id} | Score: {score:.2f} | Lead: {lead:<7} | "
        f"{num_v} Vehicle(s) | {num_alerts:02d} Alerts | {refs_count} Evidence Refs\n"
        f"     Feature: {feature}\n"
        f"     Top Factors: {reasons}\n"
        f"     Alert IDs: {', '.join(c['clustering']['memberAlertIds'])}"
    )


def test_clustering_workflow(
    source: str = "supabase",
    filter_noise: bool = True,
    out_file: Optional[str] = None,
    custom_file: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
):
    cfg = config or {}
    tw = cfg.get("temporal_window_s", 20.0)
    sw = cfg.get("spatial_window_m", 40.0)
    print_banner(f"Stage 1 Deterministic Clustering Test Runner (Source: {source})")
    print(f"Schema Contract: {SCHEMA_VERSION} | Clustering Method: {CLUSTERING_METHOD}")
    print(f"Spatial Window: {sw}m | Temporal Window: {tw}s | Topology Max Hops: 1")

    # 1. Load alerts
    telemetry_records: List[Dict[str, Any]] = []
    reference_clusters: List[Dict[str, Any]] = []
    
    if custom_file:
        raw_data = json.loads(Path(custom_file).read_text(encoding="utf-8"))
        raw_list = raw_data.get("alerts", raw_data)
        src_label = custom_file
    elif source == "supabase":
        raw_list, telemetry_records, reference_clusters = load_from_supabase()
        src_label = "Supabase PostgreSQL (public.raw_alerts)"
    elif source == "curated":
        raw_list, src_label = load_from_curated_file()
    elif source == "bulk":
        raw_list, src_label = load_from_bulk_file()
    else:
        raise ValueError(f"Unknown source: {source}")

    total_ingested = len(raw_list)
    print(f"\n[Ingest] Ingested {total_ingested} raw alert records from: {src_label}")

    # 2. Normalize and optionally filter noise
    normalized_alerts, noise_alerts = normalize_alert_batch(
        raw_list,
        telemetry_rows=telemetry_records,
        filter_noise=filter_noise,
    )

    if filter_noise and noise_alerts:
        token_reduction_pct = (len(noise_alerts) / total_ingested) * 100
        print(f"\n[Noise Filtering] Dropped {len(noise_alerts)} informational/nominal noise alert(s):")
        for na in noise_alerts:
            aid = na.get("id") or na.get("alertId")
            atype = na.get("type") or na.get("errorCode")
            amsg = na.get("message", "")
            print(f"   - [{aid}] {atype}: {amsg}")
        print(f"[Noise Filtering] Stage 1 Token Reduction: {token_reduction_pct:.1f}% noise eliminated")
    else:
        print("\n[Noise Filtering] Noise filter disabled or 0 noise alerts in stream.")

    # 3. Execute Stage 1 Clustering
    print(f"\n[Clustering] Executing ST-DBSCAN + Topology clustering on {len(normalized_alerts)} alerts...")
    clusters, safety_escalations = run_clustering(normalized_alerts, config=cfg)

    # 4. Display Results
    print_banner(f"Clustering Output Summary ({len(clusters)} Incident Clusters, {len(safety_escalations)} Safety Escalations)")

    print("\n--- SAFETY ESCALATIONS (Bypasses Urgency Scorer - Immediate Tier) ---")
    if safety_escalations:
        for idx, esc in enumerate(safety_escalations, 1):
            print(
                f"[{idx:02d}] {esc['escalationId']} | Vehicle: {esc['vehicleId']} | "
                f"Event: {esc['eciEvent']} | Error: {esc['errorCode']}\n"
                f"     Location: {esc['location']['nearestNamedFeature']} ({esc['location']['zoneId']})\n"
                f"     Source Alert: {esc['sourceAlertId']}"
            )
    else:
        print("None (0 safety channel alerts).")

    print("\n--- INCIDENT CLUSTERS (Ranked by Suggested Priority Score) ---")
    for idx, c in enumerate(clusters, 1):
        print(format_cluster_row(idx, c))
        print("-" * 80)

    # 5. Compare with reference Supabase clusters if available
    if reference_clusters:
        print_banner("Alignment Check with Supabase Reference Clusters")
        for ref in reference_clusters:
            ref_id = ref.get("cluster_id")
            ref_name = ref.get("name")
            ref_alerts = set(ref.get("raw_alert_ids") or [])
            print(f"\nReference [{ref_id}]: {ref_name} ({len(ref_alerts)} alerts: {sorted(list(ref_alerts))})")
            
            # Find best matching generated cluster
            best_match = None
            best_overlap = 0
            for gen in clusters:
                gen_alerts = set(gen["clustering"]["memberAlertIds"])
                overlap = len(ref_alerts.intersection(gen_alerts))
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_match = gen

            if best_match and best_overlap > 0:
                match_pct = (best_overlap / len(ref_alerts)) * 100
                gen_id = best_match["incidentId"]
                score = best_match["suggestedPriority"]["score"]
                lead = best_match["participatingVehicles"][0]["vehicleId"] if best_match["participatingVehicles"] else "N/A"
                print(f"   -> MATCHED to {gen_id} (Score: {score:.2f}, Lead: {lead})")
                print(f"   -> Alert Overlap: {best_overlap}/{len(ref_alerts)} ({match_pct:.0f}%)")
            else:
                print("   -> [WARN] No direct matching cluster found for this reference group.")

    # 6. Save bundle output if requested
    if out_file:
        out_path = Path(out_file)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        bundle = {
            "schemaVersion": SCHEMA_VERSION,
            "clusteringMethod": CLUSTERING_METHOD,
            "source": src_label,
            "totalIngestedAlerts": total_ingested,
            "noiseAlertsFiltered": len(noise_alerts),
            "clustersCount": len(clusters),
            "safetyEscalationsCount": len(safety_escalations),
            "yard": yard.graph_for_viewer(),
            "incidentClusters": clusters,
            "safetyEscalations": safety_escalations,
        }
        out_path.write_text(json.dumps(bundle, indent=2), encoding="utf-8")
        print(f"\n[Saved] Wrote full Stage 1 clustering bundle to: {out_path.resolve()}")

    print("\n[COMPLETE] Clustering test finished successfully!\n")
    return clusters, safety_escalations


def main():
    parser = argparse.ArgumentParser(description="Test Stage 1 ST-DBSCAN + Topology Alert Clustering")
    parser.add_argument(
        "--source",
        choices=["supabase", "curated", "bulk"],
        default="supabase",
        help="Alert data source (default: supabase - STRICTLY READ-ONLY)",
    )
    parser.add_argument(
        "--temporal-window",
        type=float,
        default=20.0,
        help="Temporal window threshold in seconds (default: 20.0)",
    )
    parser.add_argument(
        "--spatial-window",
        type=float,
        default=40.0,
        help="Spatial window threshold in meters (default: 40.0)",
    )
    parser.add_argument(
        "--no-filter-noise",
        action="store_true",
        help="Disable Stage 1 deterministic noise filtering",
    )
    parser.add_argument(
        "--out",
        type=str,
        default=str(BACKEND_DIR / "clustering" / "out" / "test_clusters.json"),
        help="Path to save output JSON bundle (default: clustering/out/test_clusters.json)",
    )
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Custom raw alert JSON file path",
    )

    args = parser.parse_args()
    config = {
        "temporal_window_s": args.temporal_window,
        "spatial_window_m": args.spatial_window,
    }
    test_clustering_workflow(
        source=args.source,
        filter_noise=not args.no_filter_noise,
        out_file=args.out,
        custom_file=args.file,
        config=config,
    )


if __name__ == "__main__":
    main()
