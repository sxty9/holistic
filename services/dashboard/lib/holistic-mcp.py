#!/usr/bin/env python3
"""Holistic MCP-standard tooling.

The declaration surface of the MCP interface, mirroring the rights (holistic-perms.py),
configuration (holistic-config.py) and consumption (holistic-usage.py) standards. Every service
DECLARES the capabilities it exposes over MCP — each tool's namespaced name, one-line description,
and the RIGHT that backs it — in a manifest dropped at /etc/holistic/mcp.d/<service>.json.

The tools are served by the central /api/mcp endpoint from an in-code registry (that is where the
handlers live); this manifest is the auditable, executable-free declaration of the MCP surface, so
the central infrastructure can see WHAT every service offers and WHICH right guards each capability
without running code. The invariant it enforces at install time: every MCP capability is covered by
the rights system — a tool names an hp_* group, or null for admin-only, and never nothing.

Subcommands:
  validate [dir]   schema + name/right checks (exit 1 on error)
  list [dir]       human-readable dump of all declared tools
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

MCP_DIR = os.environ.get("HOLISTIC_MCP_DIR", "/etc/holistic/mcp.d")

# Same id grammar as the other standards — the service id is the join key everywhere.
SERVICE_RE = re.compile(r"^[a-z][a-z0-9]{2,19}$")
# The suffix after "<service>." — a code identifier, camelCase/underscore house style.
TOOL_SUFFIX_RE = re.compile(r"^[a-z][a-zA-Z0-9_]*$")
# The backing right must be an hp_* group, exactly as the rights standard mandates (privleg only
# ever toggles hp_* groups), or null for an admin-only capability.
HP_RE = re.compile(r"^hp_[a-z0-9][a-z0-9_-]{0,27}$")


def _manifest_files(directory: str) -> list[str]:
    try:
        names = sorted(n for n in os.listdir(directory) if n.endswith(".json"))
    except FileNotFoundError:
        return []
    return [os.path.join(directory, n) for n in names]


def _load_all(directory: str) -> tuple[list[dict], list[str]]:
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
    seen_services: dict[str, str] = {}

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
        tools = m.get("tools")
        if not isinstance(tools, list) or not tools:
            errors.append(f"{f}: 'tools' must be a non-empty list")
            continue

        seen_names: set[str] = set()
        for t in tools:
            if not isinstance(t, dict):
                errors.append(f"{f}: each tool must be an object")
                continue
            name = t.get("name")
            # A tool name is fully-qualified and MUST be namespaced with its own service, so the one
            # central server aggregates every service without collision.
            prefix = f"{svc}."
            if not isinstance(name, str) or not name.startswith(prefix) or not TOOL_SUFFIX_RE.match(name[len(prefix):]):
                errors.append(f"{f}: tool name must be '{svc}.<tool>' with a code-identifier suffix, got {name!r}")
                name = name if isinstance(name, str) else "?"
            elif name in seen_names:
                errors.append(f"{f}: duplicate tool name {name}")
            else:
                seen_names.add(name)
            if not isinstance(t.get("description"), str) or not t.get("description"):
                errors.append(f"{f}: tool {name} needs a non-empty 'description'")
            # Every capability is covered by the rights system: an hp_* group, or null (admin-only).
            right = t.get("right", "__missing__")
            if right != "__missing__" and right is not None and not (isinstance(right, str) and HP_RE.match(right)):
                errors.append(f"{f}: tool {name} 'right' must be an hp_* group or null, got {right!r}")
            if right == "__missing__":
                errors.append(f"{f}: tool {name} needs a 'right' (an hp_* group, or null for admin-only)")
    return errors


def cmd_validate(args) -> int:
    manifests, errors = _load_all(args.dir)
    errors += _validate(manifests)
    if errors:
        for e in errors:
            print(f"[mcp] ERROR: {e}", file=sys.stderr)
        return 1
    n_tools = sum(len(m.get("tools", [])) for m in manifests)
    print(f"[mcp] OK — {len(manifests)} manifest(s), {n_tools} tool(s)")
    return 0


def cmd_list(args) -> int:
    manifests, errors = _load_all(args.dir)
    for e in errors:
        print(f"[mcp] WARN: {e}", file=sys.stderr)
    if not manifests:
        print("(no MCP manifests)")
        return 0
    for m in sorted(manifests, key=lambda x: x.get("service", "")):
        print(f"{m.get('service')}  (v{m.get('version')})")
        for t in m.get("tools", []) or []:
            if not isinstance(t, dict):
                continue
            right = t.get("right")
            gate = right if right else "admin-only"
            print(f"    - {t.get('name')}  [{gate}]  — {t.get('description')}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(prog="holistic-mcp")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name, fn in (("validate", cmd_validate), ("list", cmd_list)):
        sp = sub.add_parser(name)
        sp.add_argument("dir", nargs="?", default=MCP_DIR)
        sp.set_defaults(fn=fn)
    args = p.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
