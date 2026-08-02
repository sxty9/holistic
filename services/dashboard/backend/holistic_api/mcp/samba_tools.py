"""Samba's capabilities, exposed as MCP tools.

These reuse the very same path-confinement (paths.resolve_virtual) and broker client (fsclient) as
the HTTP file endpoints — no second implementation of the capability (Reuse-before-Build) — and are
gated by the same read right, hp_samba_view. So an agent reaches exactly what the user could reach
in the Files tab, no more: every tool is covered by the rights system (MCP axiom).

Read-only for now; write tools would register against hp_samba_edit / hp_samba_family_write the
same way, so the rights coverage stays symmetric with the HTTP surface.
"""
from __future__ import annotations

import json

from .. import live_config
from ..services.samba import fsclient, paths
from . import McpError, McpTool, register, text

SAMBA_VIEW = "hp_samba_view"

_PATH_SCHEMA = {
    "type": "object",
    "properties": {
        "path": {
            "type": "string",
            "description": "Virtual path within a file root, e.g. 'me/Photos' or 'family/Docs/readme.md'.",
        }
    },
    "required": ["path"],
    "additionalProperties": False,
}


def _req_path(args: dict) -> str:
    p = args.get("path")
    if not isinstance(p, str) or not p.strip():
        raise McpError("Missing required 'path' argument")
    return p


def _resolve(username: str, vpath: str) -> str:
    try:
        return paths.resolve_virtual(username, vpath)
    except paths.PathError:
        raise McpError("Invalid path")


def _list_directory(args: dict, user: dict) -> list[dict]:
    vpath = _req_path(args)
    abspath = _resolve(user["username"], vpath)
    base = paths.virtual_base(vpath)
    try:
        data = fsclient.run_json(user["username"], "list", abspath)
    except fsclient.FsError as e:
        raise McpError(str(e) or "Could not list the directory")
    entries = [{**e, "path": f"{base}/{e['name']}"} for e in data.get("entries", [])]
    return [text(json.dumps({"path": base, "entries": entries}, indent=2))]


def _stat(args: dict, user: dict) -> list[dict]:
    vpath = _req_path(args)
    abspath = _resolve(user["username"], vpath)
    try:
        meta = fsclient.run_json(user["username"], "stat", abspath)
    except fsclient.FsError as e:
        raise McpError(str(e) or "Could not stat the path")
    meta["path"] = paths.virtual_base(vpath)
    return [text(json.dumps(meta, indent=2))]


def _read_text_file(args: dict, user: dict) -> list[dict]:
    vpath = _req_path(args)
    abspath = _resolve(user["username"], vpath)
    max_text = live_config.max_text_bytes()
    try:
        meta = fsclient.run_json(user["username"], "stat", abspath)
        if meta["kind"] != "file":
            raise McpError("Not a file")
        if meta.get("viewer") not in ("text", "markdown"):
            raise McpError("Not a text file")
        data = b"".join(fsclient.stream(user["username"], abspath, offset=0, length=max_text + 1))
    except fsclient.FsError as e:
        raise McpError(str(e) or "Could not read the file")
    body = data[:max_text].decode("utf-8", "replace")
    if len(data) > max_text:
        body += "\n\n[truncated]"
    return [text(body)]


_registered = False


def register_all() -> None:
    global _registered
    if _registered:  # idempotent — create_app() may run more than once (tests)
        return
    _registered = True
    register(McpTool(
        name="samba.list_directory",
        service="samba",
        description="List the files and folders at a virtual path (e.g. 'me' or 'family/Docs').",
        input_schema=_PATH_SCHEMA,
        right=SAMBA_VIEW,
        handler=_list_directory,
    ))
    register(McpTool(
        name="samba.stat",
        service="samba",
        description="Get metadata (kind, size, mtime, mime, viewer) for a file or folder.",
        input_schema=_PATH_SCHEMA,
        right=SAMBA_VIEW,
        handler=_stat,
    ))
    register(McpTool(
        name="samba.read_text_file",
        service="samba",
        description="Read the UTF-8 text content of a text or markdown file.",
        input_schema=_PATH_SCHEMA,
        right=SAMBA_VIEW,
        handler=_read_text_file,
    ))
