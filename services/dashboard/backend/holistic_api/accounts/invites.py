"""Invite validation (read-only) + consumption via the sudo-gated wrapper.

The plaintext code is never stored; we match sha256(code) against the store written by
`holistic invite new`. Marking an invite used is delegated to holistic-invite-consume so
only root mutates the file.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import time

from ..config import settings


def _hash(code: str) -> str:
    return hashlib.sha256(code.strip().encode()).hexdigest()


def _load() -> dict:
    try:
        with open(settings.invites_path) as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {"invites": []}


def _active(inv: dict, now: float) -> bool:
    if inv.get("used_by") or inv.get("revoked"):
        return False
    exp = inv.get("expires")
    return not (exp and now > exp)


def find_active(code: str) -> str | None:
    """Return the id of the active invite matching `code`, else None."""
    if not code:
        return None
    h = _hash(code)
    now = time.time()
    for inv in _load().get("invites", []):
        if inv.get("hash") == h and _active(inv, now):
            return inv["id"]
    return None


def consume(invite_id: str, username: str) -> bool:
    if settings.dev_fake_provision:
        return True
    r = subprocess.run(["sudo", "-n", settings.invite_consume, invite_id, username])
    return r.returncode == 0


def list_invites() -> list[dict]:
    now = time.time()
    out = []
    for inv in _load().get("invites", []):
        if inv.get("used_by"):
            state = "used"
        elif inv.get("revoked"):
            state = "revoked"
        elif inv.get("expires") and now > inv["expires"]:
            state = "expired"
        else:
            state = "active"
        out.append(
            {
                "id": inv["id"],
                "note": inv.get("note", ""),
                "created": inv.get("created"),
                "expires": inv.get("expires"),
                "usedBy": inv.get("used_by"),
                "state": state,
            }
        )
    return out
