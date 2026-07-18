#!/usr/bin/env python3
"""Holistic configuration-standard tooling.

The mirror of the rights standard (holistic-perms.py), for settings instead of rights.
Every holistic service DECLARES the settings it accepts — with their defaults — in a
manifest dropped at /etc/holistic/config.d/<service>.json. Admins never edit a service's
files: they set values centrally in the Holistic Dashboard's Configuration tab, which
writes /var/lib/holistic/config/<service>.json (mode 0640, group `holistic`), and every
service daemon reads that file live — no restart, no RPC.

This tool reads the drop-in directory. It is the single source of truth for *which*
settings are legitimate: the dashboard rejects any id a manifest did not declare, and a
daemon may fall back to the declared default for anything absent — so the manifest must
be exactly as trustworthy as the values file. Hence: validate at install time.

Subcommands:
  validate [dir]   schema + id + type/default checks (exit 1 on error)
  list [dir]       human-readable dump of all declared settings
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

CONFIG_DIR = os.environ.get("HOLISTIC_CONFIG_DIR", "/etc/holistic/config.d")

# A service id is the join key of the whole landscape: it is the plugin id, the directory
# name, the manifest file stem and the values file stem — one name, everywhere.
SERVICE_RE = re.compile(r"^[a-z][a-z0-9]{2,19}$")
# Setting ids are read straight back by the daemon (c.String("routerApi", …)), so they are
# code identifiers, not slugs: camelCase is the house style.
SETTING_RE = re.compile(r"^[a-z][a-zA-Z0-9_]*$")
# Category ids only group settings for the editor.
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,30}$")

# secret == string, but the editor masks it and the values file is group-readable only.
TYPES = {"string": str, "int": int, "bool": bool, "enum": str, "secret": str}


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
        if not isinstance(data, dict):
            errors.append(f"{os.path.basename(path)}: top level must be an object")
            continue
        data["_file"] = path
        manifests.append(data)
    return manifests, errors


def _type_ok(kind: str, value: object) -> bool:
    # bool is a subclass of int in Python — an int setting must not accept `true`.
    if kind == "int":
        return isinstance(value, int) and not isinstance(value, bool)
    return isinstance(value, TYPES[kind])


def _validate(manifests: list[dict]) -> list[str]:
    errors: list[str] = []
    seen_services: dict[str, str] = {}  # service -> file that first declared it

    for m in manifests:
        f = os.path.basename(m.get("_file", "?"))
        svc = m.get("service")
        stem = f[:-5] if f.endswith(".json") else f
        if not isinstance(svc, str) or not SERVICE_RE.match(svc or ""):
            errors.append(f"{f}: 'service' must match {SERVICE_RE.pattern}, got {svc!r}")
            svc = svc if isinstance(svc, str) else "?"
        elif svc != stem:
            errors.append(f"{f}: 'service' ({svc!r}) must equal the file stem ({stem!r})")
        elif svc in seen_services:
            errors.append(f"{f}: service {svc!r} is already declared by {seen_services[svc]}")
        else:
            seen_services[svc] = f
        if not isinstance(m.get("version"), int) or m.get("version", 0) < 1:
            errors.append(f"{f}: 'version' must be an int >= 1")
        cats = m.get("categories")
        if not isinstance(cats, list) or not cats:
            errors.append(f"{f}: 'categories' must be a non-empty list")
            continue

        seen_ids: set[str] = set()  # setting ids are unique per SERVICE, not per category:
        # the daemon and the values file address a setting by its bare id.
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
            sets = c.get("settings")
            if not isinstance(sets, list) or not sets:
                errors.append(f"{f}: category {cid!r} needs a non-empty 'settings' list")
                continue
            for s in sets:
                if not isinstance(s, dict):
                    errors.append(f"{f}: each setting must be an object")
                    continue
                sid = s.get("id")
                if not isinstance(sid, str) or not SETTING_RE.match(sid or ""):
                    errors.append(f"{f}: setting id must match {SETTING_RE.pattern}, got {sid!r}")
                    sid = sid if isinstance(sid, str) else "?"
                elif sid in seen_ids:
                    errors.append(f"{f}: duplicate setting id {svc}:{sid}")
                else:
                    seen_ids.add(sid)
                if not isinstance(s.get("label"), str) or not s.get("label"):
                    errors.append(f"{f}: setting {svc}:{sid} needs a non-empty 'label'")
                kind = s.get("type")
                if kind not in TYPES:
                    errors.append(f"{f}: setting {svc}:{sid} has unknown type {kind!r} (one of {', '.join(TYPES)})")
                    continue
                if "default" not in s:
                    errors.append(f"{f}: setting {svc}:{sid} needs a 'default'")
                elif not _type_ok(kind, s["default"]):
                    errors.append(f"{f}: setting {svc}:{sid} default {s['default']!r} is not of type {kind}")
                if kind == "enum":
                    # Without options an enum is unrenderable and unvalidatable; a default
                    # outside them would be a value the admin can never restore.
                    opts = s.get("options")
                    if not isinstance(opts, list) or not opts or not all(isinstance(o, str) for o in opts):
                        errors.append(f"{f}: setting {svc}:{sid} needs a non-empty 'options' list of strings")
                    elif "default" in s and s["default"] not in opts:
                        errors.append(f"{f}: setting {svc}:{sid} default {s['default']!r} is not one of its options")
                elif "options" in s:
                    errors.append(f"{f}: setting {svc}:{sid} has 'options' but is not an enum")
                if "dangerous" in s and not isinstance(s["dangerous"], bool):
                    errors.append(f"{f}: setting {svc}:{sid} 'dangerous' must be a bool")
    return errors


def cmd_validate(args) -> int:
    manifests, errors = _load_all(args.dir)
    errors += _validate(manifests)
    if errors:
        for e in errors:
            print(f"[config] ERROR: {e}", file=sys.stderr)
        return 1
    n_settings = sum(len(c.get("settings", [])) for m in manifests for c in m.get("categories", []))
    print(f"[config] OK — {len(manifests)} manifest(s), {n_settings} setting(s)")
    return 0


def cmd_list(args) -> int:
    manifests, errors = _load_all(args.dir)
    for e in errors:
        print(f"[config] WARN: {e}", file=sys.stderr)
    if not manifests:
        print("(no configuration manifests)")
        return 0
    for m in sorted(manifests, key=lambda x: x.get("service", "")):
        print(f"{m.get('service')}  (v{m.get('version')})")
        for c in m.get("categories", []) or []:
            print(f"  {c.get('label')}  [{c.get('id')}]")
            for s in c.get("settings", []) or []:
                if not isinstance(s, dict):
                    continue
                kind = s.get("type")
                spec = f"{kind}({'|'.join(s.get('options') or [])})" if kind == "enum" else str(kind)
                flags = " !" if s.get("dangerous") else ""
                print(f"    - {s.get('id')}: {spec} = {s.get('default')!r}  — {s.get('label')}{flags}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(prog="holistic-config")
    sub = p.add_subparsers(dest="cmd", required=True)

    for name, fn in (("validate", cmd_validate), ("list", cmd_list)):
        sp = sub.add_parser(name)
        sp.add_argument("dir", nargs="?", default=CONFIG_DIR)
        sp.set_defaults(fn=fn)

    args = p.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
