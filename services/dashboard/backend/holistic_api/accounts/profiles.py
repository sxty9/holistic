"""App-managed profile data: first/last name, nickname and avatar image.

Identity (username, groups, admin) stays sourced from the OS — this only holds the
extra, user-editable fields the OS has no home for. Written DIRECTLY by the
unprivileged backend to its own state dir (/var/lib/holistic/profiles), the same
trust level as invites.json: app metadata, never an OS-identity change, so no root
escalation/wrapper is involved. Reads never raise; a missing/garbage store degrades
to empty fields.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

from ..config import settings

# Mirror auth.USER_RE — never touch the filesystem with an unvalidated name.
USER_RE = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")

# The user-editable text fields stored per user.
FIELDS = ("firstName", "lastName", "nickname")
TEXT_MAX = 200  # cap on any single text field


def _dir() -> Path:
    p = Path(settings.profiles_root)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _json_path(username: str) -> Path:
    return _dir() / f"{username}.json"


def _avatar_path(username: str) -> Path:
    return _dir() / f"{username}.avatar"


def _read_raw(username: str) -> dict:
    """The full stored dict (incl. avatarMime), or {} when absent/unreadable."""
    try:
        with open(_json_path(username)) as fh:
            raw = json.load(fh)
        return raw if isinstance(raw, dict) else {}
    except (OSError, ValueError):
        return {}


def _write_raw(username: str, data: dict) -> None:
    path = _json_path(username)
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w") as fh:
        json.dump(data, fh)
    os.replace(tmp, path)  # atomic; a crash mid-write never leaves a half file


def load(username: str) -> dict:
    """The editable text fields, always present as stripped strings."""
    raw = _read_raw(username)
    return {k: str(raw.get(k) or "").strip() for k in FIELDS}


def save(username: str, fields: dict) -> None:
    """Merge the given text fields into the store (avatarMime is preserved)."""
    raw = _read_raw(username)
    for k in FIELDS:
        if k in fields:
            raw[k] = (str(fields[k]) if fields[k] is not None else "").strip()[:TEXT_MAX]
    _write_raw(username, raw)


# --- avatar -----------------------------------------------------------------

# Magic-byte sniff (no Pillow dependency) for the formats a browser produces from
# <input type=file accept="image/*">. The stored content-type comes from the bytes,
# never from the client-declared one.
def _sniff(b: bytes) -> str | None:
    if b[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if b[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "image/webp"
    return None


def avatar_version(username: str) -> int:
    """mtime (seconds) of the avatar file, or 0 if there is none — used to bust caches."""
    try:
        return int(_avatar_path(username).stat().st_mtime)
    except OSError:
        return 0


def avatar_url(username: str) -> str | None:
    v = avatar_version(username)
    return f"/api/account/avatar/{username}?v={v}" if v else None


def avatar_mime(username: str) -> str:
    return _read_raw(username).get("avatarMime") or "application/octet-stream"


def read_avatar(username: str) -> bytes | None:
    try:
        return _avatar_path(username).read_bytes()
    except OSError:
        return None


def save_avatar(username: str, content: bytes) -> None:
    """Validate the image by its bytes and store it. Raises ValueError on a bad type."""
    mime = _sniff(content)
    if not mime:
        raise ValueError("unsupported image type")
    path = _avatar_path(username)
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "wb") as fh:
        fh.write(content)
    os.replace(tmp, path)
    raw = _read_raw(username)
    raw["avatarMime"] = mime
    _write_raw(username, raw)


def delete_avatar(username: str) -> None:
    try:
        _avatar_path(username).unlink()
    except OSError:
        pass
    raw = _read_raw(username)
    if raw.pop("avatarMime", None) is not None:
        _write_raw(username, raw)
