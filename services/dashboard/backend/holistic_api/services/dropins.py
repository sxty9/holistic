"""Shared reader for the drop-in manifest directories behind the interface standards.

The rights, configuration and consumption standards all follow ONE shape: a service DROPS a JSON
manifest into a directory (permissions.d / config.d / usage.d) and the dashboard reads them all.
The directory is untrusted — a manifest may land without ever passing the install-time validator —
so reading it is uniform and fails closed: skip anything unreadable, malformed, or whose declared
`service` does not equal its file stem.

Only the per-interface SHAPE of a manifest differs, so each router passes its own `normalize`.
This module owns the one directory-reading mechanism; the routers own their schema
(Reuse-before-Build, Keine ähnlichen Geschwister).
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Callable

# A service id is the join key of the whole landscape: plugin id == directory == manifest stem ==
# pool-file stem. The same grammar the install-time validators enforce, re-checked here because
# the drop-in dir is untrusted.
SERVICE_RE = re.compile(r"^[a-z][a-z0-9]{2,19}$")


def read_manifest_dir(directory: str, normalize: Callable[[Any, str], "dict | None"]) -> list[dict]:
    """Every usable manifest in `directory`, normalized and sorted by service.

    `normalize(data, stem)` returns the interface-specific shape, or None to drop a manifest that
    cannot be trusted (so it is invisible rather than half-rendered)."""
    try:
        names = sorted(n for n in os.listdir(directory) if n.endswith(".json"))
    except OSError:
        return []  # no drop-in dir yet → no service declares this interface
    out = []
    for name in names:
        try:
            with open(os.path.join(directory, name)) as fh:
                data = json.load(fh)
        except (OSError, json.JSONDecodeError):
            continue
        m = normalize(data, name[:-5])
        if m:
            out.append(m)
    return sorted(out, key=lambda m: m["service"])
