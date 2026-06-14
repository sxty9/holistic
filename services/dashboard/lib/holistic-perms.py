#!/usr/bin/env python3
"""Holistic rights-standard tooling.

Every holistic service may declare which fine-grained rights it offers to
NON-admin users by dropping a manifest at /etc/holistic/permissions.d/<service>.json.
Each right is backed 1:1 by a Linux group named `hp_*`; granting a right = adding
the user to that group. Admins (sudo) implicitly hold every right.

This tool reads that drop-in directory. It is the single source of truth for
*which* `hp_*` groups are legitimate rights groups — the privleg-grant wrapper
calls `is-declared` so it can NEVER be tricked into touching `sudo`, `family`,
or any group a service did not declare.

Subcommands:
  validate [dir]        schema + group-name + uniqueness checks (exit 1 on error)
  list [dir]            human-readable dump of all declared rights
  groups [dir]          print every declared backing group, one per line
  is-declared <group>   exit 0 iff <group> is a declared rights group, else 4
  ensure-groups [dir]   groupadd -f every declared group (root; idempotent)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys

PERMS_DIR = os.environ.get("HOLISTIC_PERMISSIONS_DIR", "/etc/holistic/permissions.d")

# Backing groups MUST be `hp_`-prefixed and <= 31 chars (safe Linux group name).
# The mandatory prefix is a security boundary: privleg only ever toggles hp_* groups.
GROUP_RE = re.compile(r"^hp_[a-z0-9][a-z0-9_-]{0,27}$")
# service / category / permission ids: lowercase slugs.
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,30}$")
# Never legitimate as a rights group, even if a manifest tried to claim it.
PROTECTED_GROUPS = {"sudo", "root", "wheel", "adm", "family", "smbusers", "holistic", "staff"}


def _manifest_files(directory: str) -> list[str]:
    try:
        names = sorted(n for n in os.listdir(directory) if n.endswith(".json"))
    except FileNotFoundError:
        return []
    return [os.path.join(directory, n) for n in names]


def _load_all(directory: str) -> tuple[list[dict], list[str]]:
    """Return (manifests, errors). Each manifest gets an injected `_file` key."""
    manifests: list[dict] = []
    errors: list[str] = []
    for path in _manifest_files(directory):
        try:
            with open(path) as fh:
                data = json.load(fh)
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{os.path.basename(path)}: cannot parse: {exc}")
            continue
        data["_file"] = path
        manifests.append(data)
    return manifests, errors


def _validate(manifests: list[dict]) -> list[str]:
    errors: list[str] = []
    seen_groups: dict[str, str] = {}  # group -> "service:cat:id" that first claimed it
    seen_fqids: set[str] = set()

    for m in manifests:
        f = os.path.basename(m.get("_file", "?"))
        svc = m.get("service")
        stem = f[:-5] if f.endswith(".json") else f
        if not isinstance(svc, str) or not SLUG_RE.match(svc or ""):
            errors.append(f"{f}: 'service' must be a slug, got {svc!r}")
            svc = svc if isinstance(svc, str) else "?"
        elif svc != stem:
            errors.append(f"{f}: 'service' ({svc!r}) must equal the file stem ({stem!r})")
        if not isinstance(m.get("version"), int) or m.get("version", 0) < 1:
            errors.append(f"{f}: 'version' must be an int >= 1")
        cats = m.get("categories")
        if not isinstance(cats, list):
            errors.append(f"{f}: 'categories' must be a list")
            continue
        for c in cats:
            if not isinstance(c, dict):
                errors.append(f"{f}: each category must be an object")
                continue
            cid = c.get("id")
            if not isinstance(cid, str) or not SLUG_RE.match(cid or ""):
                errors.append(f"{f}: category id must be a slug, got {cid!r}")
                cid = cid if isinstance(cid, str) else "?"
            if not isinstance(c.get("label"), str) or not c.get("label"):
                errors.append(f"{f}: category {cid!r} needs a non-empty 'label'")
            perms = c.get("permissions")
            if not isinstance(perms, list) or not perms:
                errors.append(f"{f}: category {cid!r} needs a non-empty 'permissions' list")
                continue
            for p in perms:
                if not isinstance(p, dict):
                    errors.append(f"{f}: each permission must be an object")
                    continue
                pid = p.get("id")
                if not isinstance(pid, str) or not SLUG_RE.match(pid or ""):
                    errors.append(f"{f}: permission id must be a slug, got {pid!r}")
                    pid = pid if isinstance(pid, str) else "?"
                if not isinstance(p.get("label"), str) or not p.get("label"):
                    errors.append(f"{f}: permission {svc}:{cid}:{pid} needs a non-empty 'label'")
                grp = p.get("group")
                if not isinstance(grp, str) or not GROUP_RE.match(grp or ""):
                    errors.append(
                        f"{f}: permission {svc}:{cid}:{pid} 'group' must match {GROUP_RE.pattern}, got {grp!r}"
                    )
                elif grp in PROTECTED_GROUPS:
                    errors.append(f"{f}: permission {svc}:{cid}:{pid} may not back the protected group {grp!r}")
                elif grp in seen_groups:
                    errors.append(f"{f}: group {grp!r} already backs {seen_groups[grp]} — groups must be unique")
                else:
                    seen_groups[grp] = f"{svc}:{cid}:{pid}"
                for hint in ("default", "dangerous"):
                    if hint in p and not isinstance(p[hint], bool):
                        errors.append(f"{f}: permission {svc}:{cid}:{pid} '{hint}' must be a bool")
                fqid = f"{svc}:{cid}:{pid}"
                if fqid in seen_fqids:
                    errors.append(f"{f}: duplicate permission id {fqid}")
                seen_fqids.add(fqid)
    return errors


def _iter_perms(manifests: list[dict]):
    for m in manifests:
        for c in m.get("categories", []) or []:
            if not isinstance(c, dict):
                continue
            for p in c.get("permissions", []) or []:
                if isinstance(p, dict):
                    yield p


def _all_groups(manifests: list[dict]) -> list[str]:
    out = [p["group"] for p in _iter_perms(manifests) if isinstance(p.get("group"), str)]
    seen: set[str] = set()  # de-dup, stable order
    return [g for g in out if not (g in seen or seen.add(g))]


def _default_groups(manifests: list[dict]) -> list[str]:
    """Groups for `default: true` rights — provisioning auto-grants these to every user,
    so behaviour without privleg is unchanged (the right is on until an admin revokes it)."""
    out = [p["group"] for p in _iter_perms(manifests)
           if isinstance(p.get("group"), str) and p.get("default") is True]
    seen: set[str] = set()
    return [g for g in out if not (g in seen or seen.add(g))]


def cmd_validate(args) -> int:
    manifests, errors = _load_all(args.dir)
    errors += _validate(manifests)
    if errors:
        for e in errors:
            print(f"[perms] ERROR: {e}", file=sys.stderr)
        return 1
    n_perms = sum(len(c.get("permissions", [])) for m in manifests for c in m.get("categories", []))
    print(f"[perms] OK — {len(manifests)} manifest(s), {n_perms} right(s)")
    return 0


def cmd_list(args) -> int:
    manifests, errors = _load_all(args.dir)
    for e in errors:
        print(f"[perms] WARN: {e}", file=sys.stderr)
    if not manifests:
        print("(no permission manifests)")
        return 0
    for m in sorted(manifests, key=lambda x: x.get("service", "")):
        print(f"{m.get('service')}  (v{m.get('version')})")
        for c in m.get("categories", []) or []:
            print(f"  {c.get('label')}  [{c.get('id')}]")
            for p in c.get("permissions", []) or []:
                flags = "".join(
                    t for t, on in (("!", p.get("dangerous")), ("*", p.get("default"))) if on
                )
                print(f"    - {p.get('label')}  ({p.get('group')}){(' ' + flags) if flags else ''}")
    return 0


def cmd_groups(args) -> int:
    manifests, _ = _load_all(args.dir)
    for g in _all_groups(manifests):
        print(g)
    return 0


def cmd_default_groups(args) -> int:
    manifests, _ = _load_all(args.dir)
    for g in _default_groups(manifests):
        print(g)
    return 0


def cmd_grant_defaults(args) -> int:
    """Add every holistic user (smbusers member) to every `default: true` rights group.
    Idempotent reconcile so existing users keep prior behaviour after a service adopts a
    default-on right. Root-only (changes group membership)."""
    import grp
    if os.geteuid() != 0:
        print("[perms] ERROR: grant-defaults must run as root", file=sys.stderr)
        return 2
    manifests, errors = _load_all(args.dir)
    if errors:
        for e in errors:
            print(f"[perms] ERROR: {e}", file=sys.stderr)
        return 1
    groups = _default_groups(manifests)
    if not groups:
        return 0
    try:
        members = sorted(set(grp.getgrnam("smbusers").gr_mem))
    except KeyError:
        members = []
    for g in groups:
        subprocess.run(["groupadd", "-f", g], check=True)
        for user in members:
            subprocess.run(["gpasswd", "-a", user, g], check=True,
                           stdout=subprocess.DEVNULL)
    print(f"[perms] granted {len(groups)} default right(s) to {len(members)} user(s)")
    return 0


def cmd_is_declared(args) -> int:
    """Exit 0 iff <group> is a declared, hp_-prefixed rights group. Used by privleg-grant."""
    if not GROUP_RE.match(args.group) or args.group in PROTECTED_GROUPS:
        return 4
    manifests, _ = _load_all(PERMS_DIR)
    return 0 if args.group in set(_all_groups(manifests)) else 4


def cmd_ensure_groups(args) -> int:
    if os.geteuid() != 0:
        print("[perms] ERROR: ensure-groups must run as root", file=sys.stderr)
        return 2
    manifests, errors = _load_all(args.dir)
    if errors:
        for e in errors:
            print(f"[perms] ERROR: {e}", file=sys.stderr)
        return 1
    for g in _all_groups(manifests):
        if not GROUP_RE.match(g) or g in PROTECTED_GROUPS:
            print(f"[perms] ERROR: refusing to create unsafe group {g!r}", file=sys.stderr)
            return 1
        subprocess.run(["groupadd", "-f", g], check=True)
    print(f"[perms] ensured {len(_all_groups(manifests))} group(s)")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(prog="holistic-perms")
    sub = p.add_subparsers(dest="cmd", required=True)

    for name, fn in (("validate", cmd_validate), ("list", cmd_list),
                     ("groups", cmd_groups), ("default-groups", cmd_default_groups),
                     ("ensure-groups", cmd_ensure_groups), ("grant-defaults", cmd_grant_defaults)):
        sp = sub.add_parser(name)
        sp.add_argument("dir", nargs="?", default=PERMS_DIR)
        sp.set_defaults(fn=fn)

    pi = sub.add_parser("is-declared")
    pi.add_argument("group")
    pi.set_defaults(fn=cmd_is_declared)

    args = p.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
