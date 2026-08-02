"""Samba's storage self-report for the Consumption interface.

Samba is the service that HOLDS user data on disk, so its consumption metric is the number of
bytes stored under the file roots it serves. It reports; the dashboard aggregates and assesses
(Speicher-Axiom: "welche Daten er in welchem Umfang hält … Der Service meldet nur"). The walk is
bounded and cached, so a poll never turns into an unbounded recursive `du` over a large tree.
"""
from __future__ import annotations

import os
import threading
import time

from ...config import settings

# The measured total is cached for this long. The Consumption tab polls every few seconds, but a
# stored footprint changes slowly, so a fresh recursive walk on every poll is pure waste.
_TTL_SECONDS = 60.0
# Backstop on entries visited in one walk: past it the number is a lower bound, flagged as approx.
_MAX_ENTRIES = 400_000

_cache: dict[str, float | int | bool] = {"ts": -_TTL_SECONDS, "bytes": 0, "approx": False}
# Report runs in FastAPI's threadpool, so concurrent admin polls could each start a walk on cache
# expiry; the lock lets the first walk win and the rest reuse its fresh result.
_lock = threading.Lock()


def _roots() -> list[str]:
    seen: set[str] = set()
    roots: list[str] = []
    for p in (settings.users_root, settings.family_root):
        if not p:
            continue
        real = os.path.realpath(p)
        if real not in seen and os.path.isdir(real):
            seen.add(real)
            roots.append(real)
    return roots


def _walk_bytes(roots: list[str]) -> tuple[int, bool]:
    total = 0
    seen = 0
    for root in roots:
        # followlinks=False (default): never escape a root via a symlinked directory.
        for dirpath, _dirnames, filenames in os.walk(root, onerror=lambda _e: None):
            for name in filenames:
                seen += 1
                if seen > _MAX_ENTRIES:
                    return total, True
                try:
                    total += os.lstat(os.path.join(dirpath, name)).st_size
                except OSError:
                    continue
    return total, False


def collect() -> dict[str, int]:
    if time.monotonic() - float(_cache["ts"]) < _TTL_SECONDS:
        return {"storageBytes": int(_cache["bytes"])}
    with _lock:
        # Re-check inside the lock: a walk that finished while we waited makes ours redundant.
        if time.monotonic() - float(_cache["ts"]) >= _TTL_SECONDS:
            total, approx = _walk_bytes(_roots())
            _cache.update(ts=time.monotonic(), bytes=total, approx=approx)
    return {"storageBytes": int(_cache["bytes"])}
