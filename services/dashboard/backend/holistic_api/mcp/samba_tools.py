"""Samba's capabilities, exposed as MCP tools.

Each tool is a thin adapter over the shared Samba capability layer (services.samba.ops) — the very
same functions the HTTP file endpoints call, so there is no second implementation of the capability
(Reuse-before-Build). A tool only maps ops' domain errors onto MCP errors and wraps the result in an
MCP text block. Every tool is gated by the same read right, hp_samba_view, so an agent reaches
exactly what the user could reach in the Files tab, no more: every tool is covered by the rights
system (MCP axiom).

Read-only for now; write tools would register against hp_samba_edit / hp_samba_family_write the
same way, so the rights coverage stays symmetric with the HTTP surface.
"""
from __future__ import annotations

import json

from ..services.samba import fsclient, ops, paths
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


def _list_directory(args: dict, user: dict) -> list[dict]:
    vpath = _req_path(args)
    try:
        result = ops.list_directory(user["username"], vpath)
    except paths.PathError:
        raise McpError("Invalid path")
    except fsclient.FsError as e:
        raise McpError(str(e) or "Could not list the directory")
    return [text(json.dumps(result, indent=2))]


def _stat(args: dict, user: dict) -> list[dict]:
    vpath = _req_path(args)
    try:
        meta = ops.stat(user["username"], vpath)
    except paths.PathError:
        raise McpError("Invalid path")
    except fsclient.FsError as e:
        raise McpError(str(e) or "Could not stat the path")
    return [text(json.dumps(meta, indent=2))]


def _read_text_file(args: dict, user: dict) -> list[dict]:
    vpath = _req_path(args)
    try:
        body, truncated = ops.read_text(user["username"], vpath)
    except paths.PathError:
        raise McpError("Invalid path")
    except ops.NotViewableText as e:
        raise McpError(str(e))
    except fsclient.FsError as e:
        raise McpError(str(e) or "Could not read the file")
    if truncated:
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
