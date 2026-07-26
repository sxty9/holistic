"""The dashboard's own compute + memory self-report for the Consumption interface.

The dashboard is a service like any other, so it reports its own resource use: cumulative
CPU time (Rechenzeit) and current resident memory (Arbeitsspeicher). It only measures and
reports; the aggregation/assessment lives outside it (Leistungs-/Speicher-Axiom).
"""
from __future__ import annotations

import os


def _rss_bytes() -> int:
    """Current resident set size of this backend process, in bytes. Reads /proc (Linux,
    where holistic runs); falls back to peak RSS from getrusage where /proc is absent."""
    try:
        with open("/proc/self/statm") as fh:
            resident_pages = int(fh.read().split()[1])
        return resident_pages * os.sysconf("SC_PAGE_SIZE")
    except (OSError, ValueError, IndexError):
        try:
            import resource

            # ru_maxrss is kilobytes on Linux — peak, not current, but a safe fallback.
            return int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss) * 1024
        except (ImportError, ValueError):
            return 0


def _cpu_seconds() -> float:
    """Cumulative CPU seconds consumed by this process and its waited-for children."""
    t = os.times()
    return float(t.user + t.system + t.children_user + t.children_system)


def collect() -> dict[str, float]:
    return {"cpuSeconds": round(_cpu_seconds(), 3), "memoryBytes": _rss_bytes()}
