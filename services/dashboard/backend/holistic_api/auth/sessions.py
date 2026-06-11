"""Refresh-token revocation set, persisted to /var/lib/holistic (single-worker backend)."""
from __future__ import annotations

import json
import os
import threading

from ..config import settings

_lock = threading.Lock()
_revoked: set[str] | None = None


def _load() -> set[str]:
    global _revoked
    if _revoked is None:
        try:
            with open(settings.revoked_path) as fh:
                _revoked = set(json.load(fh))
        except (OSError, ValueError):
            _revoked = set()
    return _revoked


def is_revoked(sid: str) -> bool:
    with _lock:
        return sid in _load()


def revoke(sid: str) -> None:
    with _lock:
        revoked = _load()
        revoked.add(sid)
        try:
            os.makedirs(os.path.dirname(settings.revoked_path), exist_ok=True)
            tmp = settings.revoked_path + ".tmp"
            with open(tmp, "w") as fh:
                json.dump(sorted(revoked), fh)
            os.replace(tmp, settings.revoked_path)
        except OSError:
            pass  # best-effort; a lost revocation only costs up to one access-token TTL
