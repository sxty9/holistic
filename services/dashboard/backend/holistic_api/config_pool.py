"""Passive access to the central config-values pool.

The Configuration standard writes one values file per service into config_values_dir
(services/config/router.py) and every daemon reads its file live (live_config.py). Both the admin
API that edits the pool and the daemon-side live reader must reach the file through THIS one
accessor, so there is a single data path to the entity (Zugangspunkt wiederverwenden) instead of
each side resolving the path and parsing the JSON on its own.

The pool is passive: this module only locates and reads a values file, never interprets it —
callers overlay the declared defaults and enforce types. Reads fail closed, so an absent or torn
file reads as "no central values" and callers fall back to their baked defaults.
"""
from __future__ import annotations

import json
import os

from .config import settings


def values_path(service: str) -> str:
    """Absolute path of a service's saved config-values file."""
    return os.path.join(settings.config_values_dir, f"{service}.json")


def read_values(service: str) -> dict:
    """A service's saved config values, or {} when none exist yet or the file is
    unreadable/malformed."""
    try:
        with open(values_path(service)) as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}
