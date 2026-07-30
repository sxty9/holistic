"""Central configuration mechanism — the exact mirror of the rights standard.

  rights:  permissions/<id>.json → /etc/holistic/permissions.d/<id>.json → privleg writes the
           backing Linux groups → every daemon reads the groups live.
  config:  config/<id>.json      → /etc/holistic/config.d/<id>.json declares settings+defaults →
           an admin edits values in the ONE central Configuration tab → the dashboard writes
           /var/lib/holistic/config/<id>.json → every daemon reads that file live.

So: manifests are read-only inputs OWNED BY THE SERVICES; values are the only thing this module
owns. No restart, no RPC, no per-service admin screen — the service tabs stay about the user's
experience, all configuration is bundled here.

A value reaches the file only after it validates against the declaring manifest (unknown ids
rejected, types enforced), so a daemon may trust the file's shape and fall back to the declared
default for anything absent. The write is atomic (temp → fsync → rename) because a daemon reads
the file live and must never observe a half-written config.
"""
from __future__ import annotations

import contextlib
import grp
import json
import os
import re
import tempfile
import threading
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...auth.deps import csrf_guard, require_admin
from ...config import settings
from ... import config_pool
from ..dropins import SERVICE_RE, read_manifest_dir

# Configuration is an ADMIN surface by definition (the law: "insbesondere durch Admins"), so the
# whole router is gated — exactly like routers/admin.py — and the mutating route adds CSRF.
router = APIRouter(prefix="/api/services/config", tags=["config"], dependencies=[Depends(require_admin)])

# Same rules the validator (lib/holistic-config.py) enforces at install time. Re-checked here
# because /etc/holistic/config.d is a drop-in dir: a manifest may land without ever having been
# validated, and a malformed one must be skipped, never served or written against. SERVICE_RE is
# the shared id grammar (dropins); the setting-level rules below are config-specific.
SETTING_RE = re.compile(r"^[a-z][a-zA-Z0-9_]*$")
TYPES = ("string", "int", "bool", "enum", "secret")

# Serializes the values pool's read-modify-write. put_values does read (config_pool.read_values) → merge →
# write (_write); the backend runs its sync endpoints in a threadpool, so two concurrent admin
# edits to the same service would otherwise interleave and lose one another's changes (a lost
# update) — the same reason profiles.py/sessions.py/instance.py guard their stores. The dashboard
# is the sole writer of the values files (the CLI only validates/lists), so a single in-process
# lock makes each edit atomic; config edits are rare admin actions, so one global lock across
# services is imperceptible and matches the house style.
_lock = threading.Lock()


def _valid_setting(s: Any) -> bool:
    if not isinstance(s, dict) or not SETTING_RE.match(str(s.get("id", ""))):
        return False
    if s.get("type") not in TYPES:
        return False
    if s.get("type") == "enum":
        opts = s.get("options")
        return isinstance(opts, list) and bool(opts) and all(isinstance(o, str) for o in opts)
    return True


def _norm(manifest: Any, stem: str) -> dict | None:
    """Normalize one drop-in to the shape the API promises, or None if it is unusable.
    Fails closed: a manifest we cannot trust is invisible rather than half-rendered."""
    if not isinstance(manifest, dict):
        return None
    service = manifest.get("service")
    if not isinstance(service, str) or not SERVICE_RE.match(service) or service != stem:
        return None
    cats = manifest.get("categories")
    if not isinstance(cats, list):
        return None
    seen: set[str] = set()
    out_cats = []
    for c in cats:
        if not isinstance(c, dict) or not isinstance(c.get("id"), str):
            continue
        out_settings = []
        for s in c.get("settings") or []:
            if not _valid_setting(s) or s["id"] in seen:
                continue
            seen.add(s["id"])
            out_settings.append(
                {
                    "id": s["id"],
                    "label": str(s.get("label") or s["id"]),
                    "type": s["type"],
                    "default": s.get("default"),
                    "options": list(s["options"]) if s["type"] == "enum" else None,
                    "dangerous": bool(s.get("dangerous", False)),
                }
            )
        if out_settings:
            out_cats.append(
                {
                    "id": c["id"],
                    "label": str(c.get("label") or c["id"]),
                    "description": c.get("description"),
                    "settings": out_settings,
                }
            )
    if not out_cats:
        return None
    version = manifest.get("version")
    return {
        "service": service,
        "version": version if isinstance(version, int) else 1,
        "categories": out_cats,
    }


def _manifests() -> list[dict]:
    return read_manifest_dir(settings.config_manifests_dir, _norm)


def _manifest(service: str) -> dict:
    for m in _manifests():
        if m["service"] == service:
            return m
    raise HTTPException(404, "Unknown service")


def _decls(manifest: dict) -> dict[str, dict]:
    return {s["id"]: s for c in manifest["categories"] for s in c["settings"]}


def _effective(manifest: dict) -> dict[str, Any]:
    """Declared defaults overlaid with the saved values — what the daemon actually sees.
    Anything saved but no longer declared is dropped, so a removed setting cannot linger."""
    decls = _decls(manifest)
    values = {sid: d["default"] for sid, d in decls.items()}
    for sid, v in config_pool.read_values(manifest["service"]).items():
        if sid in decls:
            values[sid] = v
    return values


def _coerce(decl: dict, value: Any) -> Any:
    """Type-check one value against its declaration. Rejects rather than converts: a config
    file the daemon can trust is worth more than a lenient API."""
    sid, kind = decl["id"], decl["type"]
    if kind in ("string", "secret"):
        if not isinstance(value, str):
            raise HTTPException(400, f"Setting '{sid}' must be text")
    elif kind == "int":
        # bool is a subclass of int in Python — True must not slip through as 1.
        if not isinstance(value, int) or isinstance(value, bool):
            raise HTTPException(400, f"Setting '{sid}' must be a whole number")
    elif kind == "bool":
        if not isinstance(value, bool):
            raise HTTPException(400, f"Setting '{sid}' must be true or false")
    elif kind == "enum":
        if value not in (decl.get("options") or []):
            raise HTTPException(400, f"Setting '{sid}' must be one of: {', '.join(decl.get('options') or [])}")
    return value


def _write(service: str, values: dict[str, Any]) -> None:
    d = settings.config_values_dir
    try:
        os.makedirs(d, mode=0o750, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=d, prefix=f".{service}.", suffix=".tmp")
        try:
            with os.fdopen(fd, "w") as fh:
                json.dump(values, fh, indent=2, sort_keys=True)
                fh.write("\n")
                fh.flush()
                os.fsync(fh.fileno())  # the bytes are on disk BEFORE anything can see the name
            # 0640, group `holistic`: the service daemons all run in that group and only ever
            # READ this file. Secrets live here, so nothing outside the group may see it.
            os.chmod(tmp, 0o640)
            with contextlib.suppress(KeyError, OSError):
                os.chown(tmp, -1, grp.getgrnam(settings.config_group).gr_gid)
            os.replace(tmp, config_pool.values_path(service))  # atomic: readers see the old or the new file, never a torn one
        except OSError:
            with contextlib.suppress(OSError):
                os.unlink(tmp)
            raise
        dfd = os.open(d, os.O_DIRECTORY)  # fsync the dir so the rename itself survives a crash
        try:
            os.fsync(dfd)
        finally:
            os.close(dfd)
    except OSError:
        raise HTTPException(500, "Could not save the configuration")


class ValuesBody(BaseModel):
    settings: dict[str, Any]


@router.get("/manifests")
def list_manifests():
    return _manifests()


@router.get("/values/{service}")
def get_values(service: str):
    m = _manifest(service)
    return {"service": service, "settings": _effective(m)}


@router.put("/values/{service}", dependencies=[Depends(csrf_guard)])
def put_values(service: str, body: ValuesBody):
    m = _manifest(service)
    decls = _decls(m)
    # Atomic read-modify-write: hold `_lock` across the read (config_pool.read_values), the merge and the write
    # so two concurrent edits to the same service cannot interleave and lose one another. The
    # response's _effective read stays inside the lock too, so it reflects exactly what we wrote
    # (no other writer slips in between). Validation raises before _write, leaving the pool
    # untouched — the released lock never guards a half-applied change.
    with _lock:
        merged = {sid: v for sid, v in config_pool.read_values(service).items() if sid in decls}
        for sid, value in body.settings.items():
            decl = decls.get(sid)
            if decl is None:
                raise HTTPException(400, f"Unknown setting '{sid}'")
            merged[sid] = _coerce(decl, value)
        _write(service, merged)
        return {"service": service, "settings": _effective(m)}
