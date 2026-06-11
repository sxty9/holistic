#!/usr/bin/env python3
"""Invite store for holistic registration.

One JSON file (/var/lib/holistic/invites.json) holding single-use, optionally
expiring codes. Codes are stored only as sha256 hashes; the plaintext is shown
once at creation. All writes take an flock so the CLI and the backend's
`holistic-invite-consume` wrapper never corrupt the file.

Subcommands: new | list | revoke <id> | consume <id> <user> | find <code>
Exit codes (consume): 0 ok · 2 bad input · 4 unknown · 5 already used · 6 expired.
"""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import re
import secrets
import sys
import time
from contextlib import contextmanager

STORE = os.environ.get("HOLISTIC_INVITES", "/var/lib/holistic/invites.json")
LOCK = STORE + ".lock"
USER_RE = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")


def _hash(code: str) -> str:
    return hashlib.sha256(code.strip().encode()).hexdigest()


@contextmanager
def _locked():
    os.makedirs(os.path.dirname(STORE), exist_ok=True)
    fd = os.open(LOCK, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def _load() -> dict:
    try:
        with open(STORE) as fh:
            return json.load(fh)
    except FileNotFoundError:
        return {"invites": []}


def _save(data: dict) -> None:
    tmp = STORE + ".tmp"
    with open(tmp, "w") as fh:
        json.dump(data, fh, indent=2)
    os.chmod(tmp, 0o640)  # group-readable: the backend (group holistic) reads it via the setgid dir
    os.replace(tmp, STORE)


def _active(inv: dict, now: float) -> bool:
    if inv.get("used_by") or inv.get("revoked"):
        return False
    exp = inv.get("expires")
    return not (exp and now > exp)


def cmd_new(args) -> int:
    code = f"{secrets.token_hex(4)}-{secrets.token_hex(4)}"
    inv = {
        "id": secrets.token_hex(4),
        "hash": _hash(code),
        "note": args.note or "",
        "created": int(time.time()),
        "expires": int(time.time() + args.expires_days * 86400) if args.expires_days else None,
        "used_by": None,
        "used_at": None,
    }
    with _locked():
        data = _load()
        data["invites"].append(inv)
        _save(data)
    print(code)
    return 0


def cmd_list(_args) -> int:
    now = time.time()
    data = _load()
    if not data["invites"]:
        print("(no invites)")
        return 0
    for inv in data["invites"]:
        if inv.get("used_by"):
            state = f"used by {inv['used_by']}"
        elif inv.get("revoked"):
            state = "revoked"
        elif not _active(inv, now):
            state = "expired"
        else:
            state = "active"
        note = f"  {inv['note']}" if inv.get("note") else ""
        print(f"{inv['id']}  {state}{note}")
    return 0


def cmd_revoke(args) -> int:
    with _locked():
        data = _load()
        inv = next((i for i in data["invites"] if i["id"] == args.id), None)
        if inv is None:
            print("unknown invite", file=sys.stderr)
            return 4
        inv["revoked"] = True
        _save(data)
    return 0


def cmd_consume(args) -> int:
    if not USER_RE.match(args.user):
        print("invalid user", file=sys.stderr)
        return 2
    now = time.time()
    with _locked():
        data = _load()
        inv = next((i for i in data["invites"] if i["id"] == args.id), None)
        if inv is None or inv.get("revoked"):
            return 4
        if inv.get("used_by"):
            return 5
        exp = inv.get("expires")
        if exp and now > exp:
            return 6
        inv["used_by"] = args.user
        inv["used_at"] = int(now)
        _save(data)
    return 0


def cmd_find(args) -> int:
    """Print the id of the active invite matching <code>, else exit 4."""
    h = _hash(args.code)
    now = time.time()
    for inv in _load()["invites"]:
        if inv["hash"] == h and _active(inv, now):
            print(inv["id"])
            return 0
    return 4


def main() -> int:
    p = argparse.ArgumentParser(prog="holistic-invites")
    sub = p.add_subparsers(dest="cmd", required=True)

    pn = sub.add_parser("new")
    pn.add_argument("--note", default="")
    pn.add_argument("--expires-days", type=int, default=0)
    pn.set_defaults(fn=cmd_new)

    sub.add_parser("list").set_defaults(fn=cmd_list)

    pr = sub.add_parser("revoke")
    pr.add_argument("id")
    pr.set_defaults(fn=cmd_revoke)

    pc = sub.add_parser("consume")
    pc.add_argument("id")
    pc.add_argument("user")
    pc.set_defaults(fn=cmd_consume)

    pf = sub.add_parser("find")
    pf.add_argument("code")
    pf.set_defaults(fn=cmd_find)

    args = p.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
