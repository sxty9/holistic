"""Virtual-path resolution + confinement. Mirrors the logic inside holistic-fs (defense in depth)."""
from __future__ import annotations

import os

from ...config import settings


class PathError(Exception):
    pass


def roots_for(user: str) -> dict[str, str]:
    return {
        "me": os.path.realpath(os.path.join(settings.users_root, user)),
        "family": os.path.realpath(settings.family_root),
    }


def list_roots(user: str) -> list[dict]:
    return [
        {"key": "me", "label": "My Drive", "writable": True},
        {"key": "family", "label": "Family", "writable": True},
    ]


def resolve_virtual(user: str, vpath: str) -> str:
    """Map a virtual path like 'me/Photos/a.jpg' to a confined absolute path."""
    if "\x00" in vpath:
        raise PathError("null byte")
    parts = vpath.strip("/").split("/", 1)
    root_key = parts[0]
    rel = parts[1] if len(parts) > 1 else ""
    roots = roots_for(user)
    if root_key not in roots:
        raise PathError("unknown root")
    base = roots[root_key]
    for comp in rel.split("/"):
        if comp == "..":
            raise PathError("traversal")
    real = os.path.realpath(os.path.normpath(os.path.join(base, rel)))
    if real != base and not real.startswith(base + os.sep):
        raise PathError("escapes root")
    return real


def virtual_base(vpath: str) -> str:
    return vpath.strip("/")
