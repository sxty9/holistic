#!/usr/bin/env python3
"""Holistic consumption-standard tooling.

The third mirror of the rights standard (holistic-perms.py) and the configuration standard
(holistic-config.py), for CONSUMPTION instead of rights or settings. Every holistic service
DECLARES which metrics it reports — with their kind — in a manifest dropped at
/etc/holistic/usage.d/<service>.json. It unifies the three consumption interfaces the axioms
name (AI tokens, compute, storage) behind one surface.

The service then writes its current measured values into the passive report pool
/var/lib/holistic/usage/<service>.json; the dashboard's Consumption tab READS every pool file,
keeps only the values whose id a manifest declared, and aggregates them. So — exactly like the
config standard — the manifest is the single source of truth for WHICH metrics are legitimate,
and must be validated at install time.

The four kinds and their canonical unit:
  storage / memory → bytes    compute → CPU seconds (cumulative)    tokens → AI tokens (count)

Subcommands:
  validate [dir]   schema + id + kind checks (exit 1 on error)
  list [dir]       human-readable dump of all declared metrics
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

USAGE_DIR = os.environ.get("HOLISTIC_USAGE_DIR", "/etc/holistic/usage.d")

# A service id is the join key of the whole landscape: plugin id, directory, manifest stem and
# pool-file stem — one name, everywhere (identical grammar to perms/config).
SERVICE_RE = re.compile(r"^[a-z][a-z0-9]{2,19}$")
# Metric ids are read straight back from the pool by the aggregator, so they are code
# identifiers, not slugs: camelCase is the house style (as with config setting ids).
METRIC_RE = re.compile(r"^[a-z][a-zA-Z0-9_]*$")

KINDS = ("storage", "memory", "compute", "tokens")


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
        metrics = m.get("metrics")
        if not isinstance(metrics, list) or not metrics:
            errors.append(f"{f}: 'metrics' must be a non-empty list")
            continue

        seen_ids: set[str] = set()  # metric ids are unique per SERVICE (the pool addresses by bare id)
        for s in metrics:
            if not isinstance(s, dict):
                errors.append(f"{f}: each metric must be an object")
                continue
            mid = s.get("id")
            if not isinstance(mid, str) or not METRIC_RE.match(mid or ""):
                errors.append(f"{f}: metric id must match {METRIC_RE.pattern}, got {mid!r}")
                mid = mid if isinstance(mid, str) else "?"
            elif mid in seen_ids:
                errors.append(f"{f}: duplicate metric id {svc}:{mid}")
            else:
                seen_ids.add(mid)
            if not isinstance(s.get("label"), str) or not s.get("label"):
                errors.append(f"{f}: metric {svc}:{mid} needs a non-empty 'label'")
            if s.get("kind") not in KINDS:
                errors.append(f"{f}: metric {svc}:{mid} has unknown kind {s.get('kind')!r} (one of {', '.join(KINDS)})")
    return errors


def cmd_validate(args) -> int:
    manifests, errors = _load_all(args.dir)
    errors += _validate(manifests)
    if errors:
        for e in errors:
            print(f"[usage] ERROR: {e}", file=sys.stderr)
        return 1
    n_metrics = sum(len(m.get("metrics", [])) for m in manifests)
    print(f"[usage] OK — {len(manifests)} manifest(s), {n_metrics} metric(s)")
    return 0


def cmd_list(args) -> int:
    manifests, errors = _load_all(args.dir)
    for e in errors:
        print(f"[usage] WARN: {e}", file=sys.stderr)
    if not manifests:
        print("(no consumption manifests)")
        return 0
    for m in sorted(manifests, key=lambda x: x.get("service", "")):
        print(f"{m.get('service')}  (v{m.get('version')})")
        for s in m.get("metrics", []) or []:
            if not isinstance(s, dict):
                continue
            print(f"    - {s.get('id')}: {s.get('kind')}  — {s.get('label')}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(prog="holistic-usage")
    sub = p.add_subparsers(dest="cmd", required=True)

    for name, fn in (("validate", cmd_validate), ("list", cmd_list)):
        sp = sub.add_parser(name)
        sp.add_argument("dir", nargs="?", default=USAGE_DIR)
        sp.set_defaults(fn=fn)

    args = p.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
