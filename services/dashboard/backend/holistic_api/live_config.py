"""Live reader for the dashboard's OWN centrally-managed settings.

The Configuration axiom binds every service — the dashboard included. Its admin-tunable knobs (the
upload/avatar/text size ceilings and the session lifetimes) are declared in config.d/dashboard.json
and edited in the ONE central Configuration tab, not left as env-only. This module reads the values
that tab writes to /var/lib/holistic/config/dashboard.json LIVE (mtime-cached), so an admin change
takes effect without a restart — the exact contract every other daemon already has with the config
standard.

Precedence: a centrally-set value wins; otherwise the process falls back to its env/baked default
(settings.*), so a host whose admin never opens the tab behaves precisely as before. Values are
unit-converted from the admin-friendly manifest units (GiB/MiB/minutes/days) to the bytes/seconds
the backend uses.
"""
from __future__ import annotations

import os
import threading

from . import config_pool
from .config import settings

_SERVICE = "dashboard"
_lock = threading.Lock()
_cache: dict[str, object] = {"mtime": None, "values": {}}


def _values() -> dict:
    """The dashboard's saved config values, reloaded only when the file's mtime changes. The read
    goes through the shared config-pool accessor (the single data path to the values file); the
    mtime cache here just keeps the hot request path off the disk between admin changes."""
    path = config_pool.values_path(_SERVICE)
    try:
        mtime = os.stat(path).st_mtime
    except OSError:
        return {}  # no central values yet → callers use their env/baked default
    with _lock:
        if _cache["mtime"] != mtime:
            _cache["values"] = config_pool.read_values(_SERVICE)
            _cache["mtime"] = mtime
        return _cache["values"]  # type: ignore[return-value]


def _positive_int(setting_id: str) -> int | None:
    v = _values().get(setting_id)
    # bool is an int subclass — a stray `true` must not read back as 1 (mirrors the config validator).
    if isinstance(v, bool) or not isinstance(v, int) or v <= 0:
        return None
    return v


def max_upload_bytes() -> int:
    gib = _positive_int("maxUploadGib")
    return gib * 1024**3 if gib is not None else settings.max_upload_bytes


def max_avatar_bytes() -> int:
    mib = _positive_int("maxAvatarMib")
    return mib * 1024**2 if mib is not None else settings.max_avatar_bytes


def max_text_bytes() -> int:
    mib = _positive_int("maxTextMib")
    return mib * 1024**2 if mib is not None else settings.max_text_bytes


def access_ttl() -> int:
    minutes = _positive_int("sessionAccessMinutes")
    return minutes * 60 if minutes is not None else settings.access_ttl


def refresh_ttl() -> int:
    days = _positive_int("sessionRefreshDays")
    return days * 86400 if days is not None else settings.refresh_ttl
