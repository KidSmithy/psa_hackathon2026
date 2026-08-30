"""
The single projection from a Stage 1 incident into the facts an LLM is allowed
to see.

This exists to make one rule enforceable in one place: **no `raw_alerts.message`
ever reaches a model.** Those messages are human-written summaries that state the
diagnosis outright — "Twistlock release actuator timed out", "Pressure reached
275 bar limit", "Busbar temperature exceeded 80.0C threshold". An agent handed
those is not investigating, it is paraphrasing, and the pipeline would look far
more capable than it is.

What is allowed through is machine-emitted signal: fault code / alert `type`,
`source`, `location`, `severity`, timestamps, and Stage 1's own derived output.
An investigator still has to call tools to learn hydraulic pressure, breaker
state or SoC — none of that is in here.

`ALLOWED_ALERT_FIELDS` is the whitelist. Anything not named there is dropped,
so a new column on raw_alerts cannot silently start leaking into prompts.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Optional

# Whitelist, not blacklist: a column added to raw_alerts later is excluded by
# default rather than included by accident.
ALLOWED_ALERT_FIELDS = ("id", "timestamp", "source", "type", "location", "severity")

# Named explicitly so the intent survives someone reading only this constant.
FORBIDDEN_ALERT_FIELDS = ("message",)


def alert_facts(row: dict[str, Any]) -> dict[str, Any]:
    """One raw alert reduced to its machine-emitted fields."""
    return {k: row[k] for k in ALLOWED_ALERT_FIELDS if k in row and row[k] is not None}


def alert_facts_batch(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [alert_facts(r) for r in rows]


def incident_facts(
    incident_id: str,
    cluster: dict[str, Any],
    alerts: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """
    The incident as the orchestrator and investigators see it.

    `alerts`, when supplied, are raw_alerts rows — they are put through
    alert_facts() rather than passed along, so a caller cannot leak messages by
    forgetting to strip them.
    """
    facts: dict[str, Any] = {
        "incident_id": incident_id,
        "location": cluster.get("target_entity"),
        "nearest_feature": cluster.get("nearest_named_feature"),
        "alert_ids": cluster.get("matched_alerts", []),
        "alert_count": len(cluster.get("matched_alerts", []) or []),
        "is_singleton": cluster.get("is_singleton", False),
        "assets_involved": cluster.get("target_assets", []),
        "stage1_problem_type": cluster.get("problem_type"),
        "stage1_priority_score": cluster.get("priority_score"),
        "stage1_priority_reasons": cluster.get("priority_reasons", []),
    }

    if alerts:
        stripped = alert_facts_batch(alerts)
        facts["alerts"] = stripped
        facts["alert_types"] = sorted({a["type"] for a in stripped if a.get("type")})
        facts["severity_mix"] = dict(
            Counter(a["severity"] for a in stripped if a.get("severity"))
        )
        times = sorted(a["timestamp"] for a in stripped if a.get("timestamp"))
        if times:
            facts["first_alert_at"] = times[0]
            facts["last_alert_at"] = times[-1]
    else:
        # Stage 1 already carries these when the caller has no raw rows to hand.
        for key in ("alert_types", "severity_mix", "first_alert_at", "last_alert_at"):
            if cluster.get(key) is not None:
                facts[key] = cluster[key]

    return {k: v for k, v in facts.items() if v is not None}


def assert_no_leaked_message(payload: Any) -> None:
    """
    Belt-and-braces check used by the tests: raises if a forbidden field appears
    anywhere in a structure about to be handed to a model.
    """
    if isinstance(payload, dict):
        for key, value in payload.items():
            if key in FORBIDDEN_ALERT_FIELDS:
                raise AssertionError(f"'{key}' must never be sent to a model: {value!r}")
            assert_no_leaked_message(value)
    elif isinstance(payload, (list, tuple)):
        for item in payload:
            assert_no_leaked_message(item)
