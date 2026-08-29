"""
Generates mock `raw_alerts` rows in exactly the shape of the 25 already seeded
in Supabase — same columns, same alert types, same message style, and only
assets that actually exist in agv_telemetry / bcss_chargers / lane_queues, so
an investigator's MCP tool calls still resolve against the real tables.

Alerts are emitted as *episodes*: a burst of related alerts that Stage 1 should
correlate into one incident, plus scattered lone alerts that should stay
singletons. That is what makes the output realistic to cluster — a flat random
stream would produce nothing but singletons and prove nothing.

Deterministic: same seed, same alerts. Used by scripts/export_stage1_sql.py.

    python scripts/mock_alerts.py --count 240 --out mock_alerts.json
"""

from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from typing import Any

# Assets that exist in the seeded database. Inventing AGV-999 would look fine
# on a timeline and then 404 the moment an investigator asked for its telemetry.
LANES = ["Lane_7", "Lane_4", "Lane_3"]
LANE_VEHICLES = ["AGV-104", "AGV-109", "AGV-112", "AGV-055"]
CHARGERS = ["BCSS-01", "BCSS-02"]
CHARGER_LOCATIONS = {"BCSS-01": "Station_BCSS_01", "BCSS-02": "Station_BCSS_02"}
FLEET_VEHICLES = ["AGV-088", "AGV-072", "AGV-201"]
CRANES = ["QC-03", "QC-04"]

# (source_template, type, severity, message_template)
# {v} vehicle, {l} lane, {s} station, {c} crane, and numeric fill-ins.
EPISODES: dict[str, list[tuple[str, str, str, str]]] = {
    "lane_jam": [
        ("{L}_ENTRY_DETECTOR", "TRAFFIC_CONGESTION", "HIGH", "Traffic stopped for > {sec}s"),
        ("{v}", "OBSTACLE_PROXIMITY", "MEDIUM", "Obstacle detected within {dist}m safety zone"),
        ("{L}_FLOW_CTRL", "HEADWAY_VIOLATION", "HIGH", "Zero vehicle clearance detected in {l}"),
        ("{L}_ZONE_MONITOR", "THROUGHPUT_DROP", "MEDIUM", "Lane throughput reduced to 0 TEU/h"),
    ],
    "actuator": [
        ("{v}", "TWISTLOCK_TIMEOUT", "CRITICAL", "Twistlock release actuator timed out"),
        ("{v}", "HYDRAULIC_HIGH_PRESSURE", "HIGH", "Pressure reached {bar} bar limit"),
    ],
    "charger_trip": [
        ("{s}", "BREAKER_TRIPPED", "CRITICAL", "Main charging circuit breaker tripped"),
        ("{s}", "OVERTEMP_WARNING", "HIGH", "Busbar temperature exceeded 80.0C threshold"),
        ("{s}", "VOLTAGE_DROP", "HIGH", "Charging bus voltage dropped to 0V"),
        ("{s}", "CHARGING_SESSION_ABORTED", "MEDIUM", "Session interrupted for target vehicle {v}"),
        ("BCSS_POWER_GRID", "BUS_FAULT", "HIGH", "Secondary sub-station load shedding triggered"),
        ("{s}", "COOLING_LOOP_FAIL", "HIGH", "Coolant flow sensor reported low delta-P"),
        ("FLEET_ROUTER", "CHARGER_UNAVAILABLE", "MEDIUM", "{s} taken out of automated routing pool"),
    ],
    "battery_starvation": [
        ("{v}", "BATTERY_LOW_CRITICAL", "CRITICAL", "Battery SoC dropped below 15% (current: {soc}%)"),
        ("FLEET_MANAGER", "REROUTE_FAIL", "HIGH", "Unable to assign alternative charger: {s} at 100% capacity"),
        ("{v}", "BATTERY_WARNING", "MEDIUM", "Battery SoC below 22%, queued for charging"),
        ("DISPATCH_OPTIMIZER", "DEADLOCK_RISK", "HIGH", "3 AGVs entering critical battery threshold in next 15 mins"),
    ],
    "lidar_stop": [
        ("{v}", "LIDAR_SAFETY_TRIP", "HIGH", "Front safety LiDAR triggered emergency stop at {dist}m"),
        ("{L}_MONITOR", "UNEXPECTED_STOP", "MEDIUM", "Vehicle {v} stopped outside designated transfer slot"),
        ("{v}", "OPTICAL_OCCLUSION", "LOW", "LiDAR sensor window optical transmittance degraded (dust/smudge)"),
    ],
    "crane_starvation": [
        ("{c}_DISPATCH", "FEEDER_STARVATION", "HIGH", "Quay crane {c} waiting for {v} payload"),
    ],
}

# Lone alerts that should not correlate with anything — these become the
# singleton incidents that the old fixed-cluster model had no way to represent.
SINGLETON_ALERTS: list[tuple[str, str, str, str]] = [
    ("{v}", "LOCALIZATION_LOST", "MEDIUM", "Odometry drift exceeded tolerance, relocalizing"),
    ("{v}", "COMMS_TIMEOUT", "MEDIUM", "No VDA5050 heartbeat for 12s"),
    ("{L}_ZONE_MONITOR", "UNEXPECTED_STOP", "MEDIUM", "Vehicle {v} stopped outside designated transfer slot"),
    ("{s}", "OVERTEMP_WARNING", "MEDIUM", "Busbar temperature trending high (76.1C)"),
    ("{c}_DISPATCH", "FEEDER_STARVATION", "MEDIUM", "Quay crane {c} cycle idle awaiting payload"),
]

# Filtered out by Stage 1 before clustering — kept so the noise-reduction
# number on the dashboard means something.
NOISE_ALERTS: list[tuple[str, str, str, str]] = [
    ("WEATHER_STATION_01", "WIND_GUST_ADVISORY", "INFO", "Wind speed {sec} m/s (below 20 m/s crane cutoff)"),
    ("QC-01", "REEFER_TEMP_NORMAL", "INFO", "Container monitoring report nominal for Reefer Block 2"),
    ("BCSS-01", "SESSION_COMPLETED", "INFO", "{v} charge cycle finished (94% SoC)"),
]

NOISE_LOCATIONS = {
    "WIND_GUST_ADVISORY": "Terminal_Wide",
    "REEFER_TEMP_NORMAL": "Berth_01",
    "SESSION_COMPLETED": "Station_BCSS_01",
}


def _fill(template: str, ctx: dict[str, Any], rng: random.Random) -> str:
    return template.format(
        v=ctx.get("v", "AGV-104"),
        l=ctx.get("l", "Lane_7"),
        L=ctx.get("l", "Lane_7").upper().replace("-", "_"),
        s=ctx.get("s", "BCSS-02"),
        c=ctx.get("c", "QC-03"),
        sec=rng.randint(9, 120),
        dist=round(rng.uniform(0.6, 2.4), 1),
        bar=rng.randint(240, 285),
        soc=round(rng.uniform(8.0, 14.9), 1),
    )


def generate(
    count: int = 240,
    seed: int = 7,
    start: str = "2026-08-24T08:00:00Z",
    span_minutes: int = 45,
    id_prefix: str = "ALT-1",
) -> list[dict[str, Any]]:
    """
    Returns `count` raw_alerts rows sorted by timestamp, mixing correlated
    episodes, lone alerts and noise.
    """
    rng = random.Random(seed)
    t0 = datetime.strptime(start, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    span = timedelta(minutes=span_minutes)

    rows: list[dict[str, Any]] = []

    def emit(offset: timedelta, source: str, atype: str, location: str, severity: str, message: str) -> None:
        rows.append(
            {
                "_offset": offset,
                "source": source,
                "type": atype,
                "location": location,
                "severity": severity,
                "message": message,
            }
        )

    # Roughly 60% of alerts come from episodes, 25% are lone alerts, 15% noise.
    episode_budget = int(count * 0.60)
    singleton_budget = int(count * 0.25)
    noise_budget = max(0, count - episode_budget - singleton_budget)

    episode_names = list(EPISODES)
    while sum(1 for r in rows) < episode_budget:
        name = rng.choice(episode_names)
        lane = rng.choice(LANES)
        ctx = {
            "l": lane,
            "v": rng.choice(LANE_VEHICLES if name in {"lane_jam", "actuator", "lidar_stop"} else FLEET_VEHICLES),
            "s": rng.choice(CHARGERS),
            "c": rng.choice(CRANES),
        }
        if name == "charger_trip":
            location = CHARGER_LOCATIONS[ctx["s"]]
        elif name == "battery_starvation":
            location = "Sector_A"
        else:
            location = lane

        base = timedelta(seconds=rng.uniform(0, span.total_seconds()))
        members = EPISODES[name]
        # A partial episode is normal — not every failure emits every symptom.
        take = rng.randint(max(1, len(members) // 2), len(members))
        gap = 0.0
        for source_t, atype, severity, message_t in members[:take]:
            gap += rng.uniform(3, 28)
            # An occasional CRITICAL LiDAR trip routes to the safety channel
            # instead of being scored, which is what populates safety_escalations.
            sev = "CRITICAL" if (atype == "LIDAR_SAFETY_TRIP" and rng.random() < 0.35) else severity
            emit(
                base + timedelta(seconds=gap),
                _fill(source_t, ctx, rng),
                atype,
                location,
                sev,
                _fill(message_t, ctx, rng),
            )

    for _ in range(singleton_budget):
        lane = rng.choice(LANES)
        ctx = {
            "l": lane,
            "v": rng.choice(LANE_VEHICLES + FLEET_VEHICLES),
            "s": rng.choice(CHARGERS),
            "c": rng.choice(CRANES),
        }
        source_t, atype, severity, message_t = rng.choice(SINGLETON_ALERTS)
        location = CHARGER_LOCATIONS[ctx["s"]] if source_t == "{s}" else lane
        emit(
            timedelta(seconds=rng.uniform(0, span.total_seconds())),
            _fill(source_t, ctx, rng),
            atype,
            location,
            severity,
            _fill(message_t, ctx, rng),
        )

    for _ in range(noise_budget):
        ctx = {"v": rng.choice(FLEET_VEHICLES)}
        source_t, atype, severity, message_t = rng.choice(NOISE_ALERTS)
        emit(
            timedelta(seconds=rng.uniform(0, span.total_seconds())),
            _fill(source_t, ctx, rng),
            atype,
            NOISE_LOCATIONS[atype],
            severity,
            _fill(message_t, ctx, rng),
        )

    rows.sort(key=lambda r: r["_offset"])
    out: list[dict[str, Any]] = []
    for i, row in enumerate(rows, start=1):
        ts = t0 + row.pop("_offset")
        out.append({"id": f"{id_prefix}{i:03d}", "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S+00"), **row})
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate mock raw_alerts rows")
    parser.add_argument("--count", type=int, default=240)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--start", default="2026-08-24T08:00:00Z")
    parser.add_argument("--span-minutes", type=int, default=45)
    parser.add_argument("--out", default=None, help="Write JSON here instead of stdout")
    args = parser.parse_args()

    rows = generate(args.count, args.seed, args.start, args.span_minutes)
    payload = json.dumps(rows, indent=2)
    if args.out:
        from pathlib import Path

        Path(args.out).write_text(payload, encoding="utf-8")
        print(f"Wrote {len(rows)} alerts to {args.out}")
    else:
        print(payload)


if __name__ == "__main__":
    main()
