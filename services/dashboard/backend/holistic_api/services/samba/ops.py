"""Samba's read capabilities as plain functions — the single implementation of each file operation.

The HTTP file endpoints (router.py) and the Samba MCP tools (mcp/samba_tools.py) are thin adapters
over these functions: each resolves the path, reaches the broker and shapes the entries here ONCE,
then the caller maps the domain errors (paths.PathError / fsclient.FsError / NotViewableText) onto
its own surface — an HTTP status vs an MCP error — and its own envelope. So a capability is written
once and reached identically from both (Reuse-before-Build, Keine ähnlichen Geschwister); an agent
reaches exactly what the user could reach in the Files tab, no more.
"""
from __future__ import annotations

from ... import live_config
from . import fsclient, paths


class NotViewableText(Exception):
    """A stat succeeded but the target cannot be read as text. `is_file` distinguishes "not a file
    at all" from "a file, but not a text/markdown viewer", so each caller keeps its exact
    status/message (HTTP 400 vs 415)."""

    def __init__(self, is_file: bool) -> None:
        super().__init__("Not a text file" if is_file else "Not a file")
        self.is_file = is_file


def list_directory(username: str, vpath: str) -> dict:
    """The listing at a virtual path: {path, entries[]} with each entry's virtual path filled in.
    Raises paths.PathError (bad path) / fsclient.FsError (broker)."""
    abspath = paths.resolve_virtual(username, vpath)
    base = paths.virtual_base(vpath)
    data = fsclient.run_json(username, "list", abspath)
    entries = [{**e, "path": f"{base}/{e['name']}"} for e in data.get("entries", [])]
    return {"path": base, "entries": entries}


def stat(username: str, vpath: str) -> dict:
    """Metadata for one file/folder, with its virtual path filled in. Raises paths.PathError /
    fsclient.FsError."""
    abspath = paths.resolve_virtual(username, vpath)
    meta = fsclient.run_json(username, "stat", abspath)
    meta["path"] = paths.virtual_base(vpath)
    return meta


def read_text(username: str, vpath: str) -> tuple[str, bool]:
    """A text/markdown file decoded as UTF-8, returned as (content, truncated). The size ceiling is
    the live-configured max_text_bytes. Raises paths.PathError / fsclient.FsError, or
    NotViewableText when the target is not a readable text file."""
    abspath = paths.resolve_virtual(username, vpath)
    max_text = live_config.max_text_bytes()
    meta = fsclient.run_json(username, "stat", abspath)
    if meta["kind"] != "file":
        raise NotViewableText(is_file=False)
    if meta.get("viewer") not in ("text", "markdown"):
        raise NotViewableText(is_file=True)
    data = b"".join(fsclient.stream(username, abspath, offset=0, length=max_text + 1))
    truncated = len(data) > max_text
    return data[:max_text].decode("utf-8", "replace"), truncated
