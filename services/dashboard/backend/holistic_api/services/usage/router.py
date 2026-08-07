"""Consumption (Verbrauch) — the third mirror of the rights standard.

  rights:  permissions.d declares rights → privleg writes the backing groups → daemons read them.
  config:  config.d declares settings   → the dashboard writes admin values → daemons read them.
  usage:   usage.d declares WHICH metrics a service reports (kind + label) → each service writes
           its current values into the passive pool /var/lib/holistic/usage/<id>.json → THIS
           module reads them all and aggregates.

It unifies the three consumption interfaces the axioms name — AI tokens, compute (Leistung) and
storage (Speicher) — behind one drop-in surface, so load and capacity can be judged across the
whole landscape from one place.

Like the Configuration tab this is an ADMIN surface (consumption telemetry is a cross-service
operations concern, not a normal-user one), so the whole router is gated by require_admin. The
service tabs stay about the user's experience, never the telemetry. The service only REPORTS;
the evaluation — per-service metrics and landscape totals per kind — is computed HERE, outside
the services, over a purely passive pool.
"""
from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends

from ...auth.deps import require_admin
from ...config import settings
from ..dropins import SERVICE_RE, read_manifest_dir
from . import reporters

router = APIRouter(prefix="/api/services/usage", tags=["usage"], dependencies=[Depends(require_admin)])

# SERVICE_RE is the shared id grammar (dropins) — the join key of the whole landscape (plugin id
# == directory == manifest stem == pool-file stem); metrics use their own id grammar below.
METRIC_RE = re.compile(r"^[a-z][a-zA-Z0-9_]*$")

# The four consumption kinds and their canonical unit. Every declared metric names one kind, so a
# metric is self-describing and metrics of the same kind are summable across services.
#   storage/memory → bytes;  compute → CPU seconds (cumulative);  tokens → AI tokens (count).
KIND_UNIT = {"storage": "bytes", "memory": "bytes", "compute": "seconds", "tokens": "count"}


def _norm(manifest: Any, stem: str) -> dict | None:
    """Normalize one drop-in to the shape the API promises, or None if unusable. Fails closed:
    a manifest we cannot trust is invisible rather than half-rendered (mirrors the config router)."""
    if not isinstance(manifest, dict):
        return None
    service = manifest.get("service")
    if not isinstance(service, str) or not SERVICE_RE.match(service) or service != stem:
        return None
    metrics = manifest.get("metrics")
    if not isinstance(metrics, list):
        return None
    seen: set[str] = set()
    out_metrics = []
    for m in metrics:
        if not isinstance(m, dict):
            continue
        mid = m.get("id")
        kind = m.get("kind")
        if not isinstance(mid, str) or not METRIC_RE.match(mid) or mid in seen or kind not in KIND_UNIT:
            continue
        seen.add(mid)
        out_metrics.append(
            {"id": mid, "label": str(m.get("label") or mid), "kind": kind, "unit": KIND_UNIT[kind]}
        )
    if not out_metrics:
        return None
    version = manifest.get("version")
    return {
        "service": service,
        "version": version if isinstance(version, int) else 1,
        "metrics": out_metrics,
    }


def _manifests() -> list[dict]:
    return read_manifest_dir(settings.usage_manifests_dir, _norm)


def _number(value: Any) -> float | int:
    # bool is an int subclass — a stray `true` must not count as 1.
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0
    return value


def _values(service: str, live: dict | None) -> dict:
    """The service's reported values: its passive pool file overlaid with fresh in-process
    collector output where the dashboard collects it in-repo (live wins, never stale here)."""
    values = dict(reporters.read_report(service))
    if live:
        values.update(live)
    return values


@router.get("/report")
def report():
    """Aggregate every service's declared metrics against its reported values, plus landscape
    totals per kind. Only declared metrics are surfaced; a reported id no other manifest declares
    is dropped, exactly as the config tab drops an undeclared value."""
    manifests = _manifests()
    live = reporters.refresh()  # in-process collectors + best-effort write-through to the pool
    services = []
    totals = {kind: 0 for kind in KIND_UNIT}
    for m in manifests:
        svc = m["service"]
        values = _values(svc, live.get(svc))
        metrics_out = []
        for metric in m["metrics"]:
            value = _number(values.get(metric["id"], 0))
            totals[metric["kind"]] += value
            metrics_out.append({**metric, "value": value})
        services.append({"service": svc, "version": m["version"], "metrics": metrics_out})
    kinds = [{"kind": kind, "unit": unit, "total": totals[kind]} for kind, unit in KIND_UNIT.items()]
    return {"services": services, "kinds": kinds}
