"""In-process collectors + the passive report pool for the Consumption interface.

Every holistic service REPORTS its consumption (Consumption axiom: "Der Service meldet nur; die
Auswertung liegt außerhalb"). A service running in its own process writes its report file into
the passive pool directly. For services whose backend runs inside THIS process — the dashboard
itself, and samba, whose file endpoints live here — the self-report is produced by an in-process
collector and written through to the same pool. The aggregator reads every service the same way.

The pool file /var/lib/holistic/usage/<service>.json is a pure, passive store: it holds the
reported numbers and nothing interprets them here (passive-data-pools axiom). The write is atomic
(temp → fsync → rename), matching the config-values write, so a reader never sees a torn file.
"""
from __future__ import annotations

import contextlib
import grp
import json
import os
import tempfile
import time

from ...config import settings
from ..samba import usage as samba_usage
from . import system

# service_id -> zero-arg collector returning {metric_id: number}. The id is the join key with the
# service's usage.d manifest and its pool file stem — one name everywhere, like config/permissions.
COLLECTORS = {
    "dashboard": system.collect,
    "samba": samba_usage.collect,
}


def _report_path(service: str) -> str:
    return os.path.join(settings.usage_values_dir, f"{service}.json")


def read_report(service: str) -> dict:
    """The reported values a service wrote to the passive pool, or {} if none/unreadable."""
    try:
        with open(_report_path(service)) as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return {}
    metrics = data.get("metrics") if isinstance(data, dict) else None
    return metrics if isinstance(metrics, dict) else {}


def write_report(service: str, metrics: dict) -> None:
    """Atomically write one service's report into the passive pool. 0640/group `holistic` — the
    same trust boundary as config values. Best-effort: telemetry must never crash a daemon, so an
    unwritable pool (e.g. wrong owner) is swallowed and the aggregator falls back to live values."""
    d = settings.usage_values_dir
    payload = {"metrics": metrics, "ts": int(time.time() * 1000)}
    try:
        os.makedirs(d, mode=0o750, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=d, prefix=f".{service}.", suffix=".tmp")
        try:
            with os.fdopen(fd, "w") as fh:
                json.dump(payload, fh, sort_keys=True)
                fh.flush()
                os.fsync(fh.fileno())
            os.chmod(tmp, 0o640)
            with contextlib.suppress(KeyError, OSError):
                os.chown(tmp, -1, grp.getgrnam(settings.config_group).gr_gid)
            os.replace(tmp, _report_path(service))
        except OSError:
            with contextlib.suppress(OSError):
                os.unlink(tmp)
            raise
    except OSError:
        pass


def refresh() -> dict[str, dict]:
    """Run every in-process collector, write each through to the pool, and return the collected
    values — so the aggregator is live for in-repo services even where no external timer drives
    the pool. A collector that raises is skipped, never fatal."""
    out: dict[str, dict] = {}
    for service, collector in COLLECTORS.items():
        try:
            metrics = collector()
        except Exception:
            continue
        out[service] = metrics
        write_report(service, metrics)
    return out
