"""The central Holistic MCP server — one uniformly-named JSON-RPC endpoint at /api/mcp.

Every service's MCP tools are aggregated here and dispatched by their namespaced name, so the whole
landscape is reachable through ONE address, resolved server-side and never taken from a request
(no host/URL field is ever read from the body) — a manipulated call cannot point an agent at a
foreign host (MCP axiom). The endpoint is session-gated by current_user and every tool re-checks its
backing right, so MCP acts strictly on behalf of the signed-in user, within their rights.

Implements the core MCP methods over Streamable-HTTP JSON-RPC 2.0: initialize, tools/list,
tools/call, ping, and the initialized notification. Backend only — there is no dashboard tab.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse

from ..auth.deps import current_user
from . import McpError, require, text, tools_for

router = APIRouter(prefix="/api/mcp", tags=["mcp"])

# The newest protocol revision we speak; we echo the client's requested revision when it sends one.
PROTOCOL_VERSION = "2025-06-18"
SERVER_INFO = {"name": "holistic", "version": "1.0.0"}


def _result(mid: Any, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": mid, "result": result}


def _error(mid: Any, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": mid, "error": {"code": code, "message": message}}


def _call_tool(user: dict, params: dict) -> dict:
    name = params.get("name")
    if not isinstance(name, str):
        raise _Invalid("tools/call requires a string 'name'")
    tool = require(user, name)  # McpError if unknown or the right is not held
    args = params.get("arguments") or {}
    if not isinstance(args, dict):
        raise _Invalid("'arguments' must be an object")
    try:
        content = tool.handler(args, user)
    except McpError as e:
        return {"content": [text(str(e))], "isError": True}
    except Exception:
        # A genuine bug must not leak internals to the agent, but must not crash the transport.
        return {"content": [text("The tool failed to execute.")], "isError": True}
    return {"content": content, "isError": False}


class _Invalid(Exception):
    """Bad params → JSON-RPC -32602."""


def _dispatch(msg: Any, user: dict) -> dict | None:
    """Handle one JSON-RPC message. Returns the response envelope, or None for a notification."""
    if not isinstance(msg, dict):
        return _error(None, -32600, "Invalid Request")
    mid = msg.get("id")
    is_notification = "id" not in msg
    method = msg.get("method")

    try:
        if method == "initialize":
            requested = (msg.get("params") or {}).get("protocolVersion")
            result: dict = {
                "protocolVersion": requested if isinstance(requested, str) else PROTOCOL_VERSION,
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": SERVER_INFO,
            }
        elif method == "ping":
            result = {}
        elif method == "tools/list":
            result = {
                "tools": [
                    {"name": t.name, "description": t.description, "inputSchema": t.input_schema}
                    for t in tools_for(user)
                ]
            }
        elif method == "tools/call":
            result = _call_tool(user, msg.get("params") or {})
        elif isinstance(method, str) and method.startswith("notifications/"):
            return None  # accepted, nothing to answer (e.g. notifications/initialized)
        else:
            return None if is_notification else _error(mid, -32601, f"Method not found: {method}")
    except _Invalid as e:
        return None if is_notification else _error(mid, -32602, str(e))
    except McpError as e:
        # require() rejected the tool (unknown / not permitted) — surface as a normal error.
        return None if is_notification else _error(mid, -32602, str(e))

    return None if is_notification else _result(mid, result)


@router.post("")
async def mcp_endpoint(request: Request, user: dict = Depends(current_user)):
    try:
        payload = await request.json()
    except Exception:
        return JSONResponse(_error(None, -32700, "Parse error"))

    if isinstance(payload, list):
        responses = [r for r in (_dispatch(m, user) for m in payload) if r is not None]
        return JSONResponse(responses) if responses else Response(status_code=202)

    resp = _dispatch(payload, user)
    return JSONResponse(resp) if resp is not None else Response(status_code=202)
