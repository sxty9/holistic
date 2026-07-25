"""App-managed profile data: first/last name, nickname and avatar image.

Identity (username, groups, admin) stays sourced from the OS — this only holds the
extra, user-editable fields the OS has no home for. Written DIRECTLY by the
unprivileged backend to its own state dir (/var/lib/holistic/profiles), the same
trust level as invites.json: app metadata, never an OS-identity change, so no root
escalation/wrapper is involved. Reads never raise; a missing/garbage store degrades
to empty fields.
"""
from __future__ import annotations

import contextlib
import json
import os
import re
import tempfile
import threading
from pathlib import Path

from ..config import settings

# Mirror auth.USER_RE — never touch the filesystem with an unvalidated name.
USER_RE = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")

# The user-editable text fields stored per user.
FIELDS = ("firstName", "lastName", "nickname")
TEXT_MAX = 200  # cap on any single text field

# Serializes the text store's read-modify-write. The backend runs its sync endpoints in a
# threadpool, so two concurrent profile updates would otherwise interleave read and write and
# lose one another's changes — the same reason sessions.py/instance.py guard their stores.
_lock = threading.Lock()


def _dir() -> Path:
    p = Path(settings.profiles_root)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _json_path(username: str) -> Path:
    return _dir() / f"{username}.json"


def _avatar_path(username: str) -> Path:
    return _dir() / f"{username}.avatar"


def _read_raw(username: str) -> dict:
    """The stored dict as-is, or {} when absent/unreadable."""
    try:
        with open(_json_path(username)) as fh:
            raw = json.load(fh)
        return raw if isinstance(raw, dict) else {}
    except (OSError, ValueError):
        return {}


def _atomic_write(path: Path, data: bytes) -> None:
    """Write `data` to `path` atomically. The temp file gets a UNIQUE name (not a fixed
    `.tmp`) so concurrent writers to the same record never collide on it, and os.replace
    means a reader sees the whole old or whole new file — never a torn, empty or missing one."""
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        os.chmod(tmp, 0o644)  # mkstemp is 0600; keep the store's prior world-readable-by-owner mode
        os.replace(tmp, path)
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(tmp)
        raise


def _write_raw(username: str, data: dict) -> None:
    _atomic_write(_json_path(username), json.dumps(data).encode())


def load(username: str) -> dict:
    """The editable text fields, always present as stripped strings."""
    raw = _read_raw(username)
    return {k: str(raw.get(k) or "").strip() for k in FIELDS}


def save(username: str, fields: dict) -> None:
    """Merge the given text fields into the store, atomically.

    The whole read-modify-write is taken under `_lock`, so two concurrent updates can never
    lose each other's changes. Only the declared text FIELDS are persisted, so the pool holds
    nothing but raw, user-entered data (any legacy derived key is dropped on the next save)."""
    with _lock:
        data = load(username)  # clean {FIELDS: str}
        for k in FIELDS:
            if k in fields:
                data[k] = (str(fields[k]) if fields[k] is not None else "").strip()[:TEXT_MAX]
        _write_raw(username, data)


# --- avatar -----------------------------------------------------------------

# Magic-byte sniff (no Pillow dependency) for the formats a browser produces from
# <input type=file accept="image/*">. The content-type is judged from the bytes, never from
# the client-declared one — on write to reject a bad upload, and on read to serve it.
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


def sniff_mime(content: bytes) -> str:
    """The content-type to serve `content` with, judged only from its own magic bytes. Derived
    on read: the avatar file is the single source of truth for both the image and its type, so
    nothing derived is kept in the store and the two can never fall out of sync."""
    return _sniff(content) or "application/octet-stream"


def read_avatar(username: str) -> bytes | None:
    try:
        return _avatar_path(username).read_bytes()
    except OSError:
        return None


def save_avatar(username: str, content: bytes) -> None:
    """Validate the image by its bytes and store it atomically. Raises ValueError on a bad type.

    The bytes are the whole record — the type is re-derived on read (see sniff_mime) — so this
    touches a single file with one atomic rename and needs no coordination with the text store."""
    if not _sniff(content):
        raise ValueError("unsupported image type")
    _atomic_write(_avatar_path(username), content)  # atomic: whole old or whole new image, never torn


def delete_avatar(username: str) -> None:
    try:
        _avatar_path(username).unlink()  # atomic; the type was never stored, nothing else to undo
    except OSError:
        pass
