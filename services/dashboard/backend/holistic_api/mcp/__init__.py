"""The Holistic MCP tool registry — the backend side of the MCP interface.

Every service exposes its capabilities as Model-Context-Protocol tools (MCP axiom). They are all
served through ONE central, uniformly-named endpoint (holistic_api/mcp/router.py at /api/mcp),
addressable via the central infrastructure exactly like the central rights management — the
server's address is fixed server-side and is never read from a request, so no manipulated call can
point an agent at a foreign host.

A tool is registered in-code with the handler that runs it plus the RIGHT that backs it: every
capability offered over MCP is covered by the rights system (MCP axiom). `tools_for` filters to
what the calling user may use and `require` re-checks at call time, so MCP can never do more than
the same user could do in the UI. Tool names are namespaced `<service>.<tool>`, so the one central
server aggregates every service's capabilities without collision.

This is purely backend: there is no dashboard tab for MCP.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

# A handler receives the validated arguments and the calling user (the same dict shape the HTTP
# deps produce: {"username","isAdmin","groups",...}) and returns MCP content blocks. It may raise
# McpError to signal a tool-level failure (reported to the agent, not a transport error).
Handler = Callable[[dict, dict], list[dict]]


class McpError(Exception):
    """A tool-level failure surfaced to the agent as an MCP error result (isError=true)."""


@dataclass(frozen=True)
class McpTool:
    name: str  # fully-qualified, "<service>.<tool>"
    service: str
    description: str
    input_schema: dict
    # Backing right (an hp_* group). None means the tool is admin-only (no non-admin group grants
    # it) — every tool is thus covered by the rights system, never ungated.
    right: str | None
    handler: Handler = field(compare=False)


_REGISTRY: dict[str, McpTool] = {}


def register(tool: McpTool) -> None:
    if not tool.name.startswith(f"{tool.service}."):
        raise ValueError(f"MCP tool {tool.name!r} must be namespaced '{tool.service}.<tool>'")
    if tool.name in _REGISTRY:
        raise ValueError(f"duplicate MCP tool {tool.name!r}")
    _REGISTRY[tool.name] = tool


def allowed(user: dict, right: str | None) -> bool:
    """The one enforcement rule, identical to the HTTP rights standard: admins pass; otherwise the
    user must hold the backing group. An admin-only tool (right=None) is reachable only by admins."""
    if user.get("isAdmin"):
        return True
    return right is not None and right in user.get("groups", [])


def tools_for(user: dict) -> list[McpTool]:
    """Every tool the user may use, sorted by name — what tools/list returns for this caller."""
    return sorted((t for t in _REGISTRY.values() if allowed(user, t.right)), key=lambda t: t.name)


def require(user: dict, name: str) -> McpTool:
    """Resolve a tool for a tools/call, enforcing the backing right. Raises McpError otherwise, so
    an undeclared or forbidden name is indistinguishable to the caller from 'no such tool'."""
    tool = _REGISTRY.get(name)
    if tool is None or not allowed(user, tool.right):
        raise McpError(f"Unknown or not permitted tool: {name}")
    return tool


def text(s: str) -> dict:
    """An MCP text content block."""
    return {"type": "text", "text": s}
