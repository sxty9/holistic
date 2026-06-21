"""Runtime domain awareness — what domain is this instance currently served on?

holistic is deliberately portable: it runs same-origin behind Caddy on whatever domain
the operator points at it (a friend self-hosting on their own server gets their own
domain, with no code change and no mandatory config). So instead of a hardcoded hostname
we read the live origin from the request on each call.

Trust boundary — why X-Forwarded-* is trusted here:
  The backend binds to 127.0.0.1:8770 only (see the systemd unit); the *single* peer that
  can reach it is Caddy (and, for the public path, cloudflared → Caddy, also via loopback).
  Caddy's default `trusted_proxies` is empty, so it OVERWRITES any client-supplied
  X-Forwarded-* with the true connecting values. The systemd ExecStart also passes
  `--proxy-headers --forwarded-allow-ips=127.0.0.1` to make this explicit. We therefore
  do NOT allow-list hosts (that would defeat "runs on any domain") — host validation is
  Caddy's/cloudflared's job at the listener.

The MAIL DOMAIN is decoupled from the per-request origin: an email address must be stable
and deliverable, so it is learned once from the first PUBLIC access and persisted to
instance.json, with an env override (HOLISTIC_MAIL_DOMAIN) winning over everything.
"""
from __future__ import annotations

import ipaddress
import json
import os
import threading

from fastapi import Request

from .config import settings

# Hosts that exist but are not a deliverable public mail domain.
_NON_PUBLIC_SUFFIXES = (".local", ".lan", ".internal", ".home.arpa")


def _strip_port(host: str) -> str:
    host = host.strip()
    if host.startswith("["):  # bracketed IPv6, e.g. [::1]:21487
        return host[1 : host.find("]")] if "]" in host else host
    # host:port — but a bare IPv6 also contains colons, so only split a single trailing one.
    if host.count(":") == 1:
        host = host.split(":", 1)[0]
    return host


def _first(value: str | None) -> str:
    """X-Forwarded-* may be a comma list (proxy chain); the first entry is the client-facing one."""
    return (value or "").split(",")[0].strip()


def request_host(request: Request) -> str:
    """The hostname (no scheme, no port) the client used to reach this instance."""
    host = _first(request.headers.get("x-forwarded-host")) or request.headers.get("host", "")
    return _strip_port(host) or _strip_port(request.url.netloc)


def request_origin(request: Request) -> str:
    """scheme://host[:port] for the current request, e.g. 'https://example.com'."""
    if settings.public_origin:
        return settings.public_origin
    proto = _first(request.headers.get("x-forwarded-proto")) or request.url.scheme
    host = _first(request.headers.get("x-forwarded-host")) or request.headers.get("host", "") or request.url.netloc
    return f"{proto}://{host.strip()}"


def _is_public_host(host: str) -> bool:
    """True if `host` looks like a real, internet-routable mail domain (not LAN/loopback/IP)."""
    host = host.strip().lower().rstrip(".")
    if not host or "." not in host or host == "localhost":
        return False
    if host.endswith(_NON_PUBLIC_SUFFIXES):
        return False
    try:
        ipaddress.ip_address(host)  # bare IP literal → not a domain
        return False
    except ValueError:
        return True


# --- persisted canonical mail domain (single-worker backend, mirrors sessions.py) ---
_lock = threading.Lock()
_cache: dict | None = None


def _load() -> dict:
    global _cache
    if _cache is None:
        try:
            with open(settings.instance_path) as fh:
                _cache = json.load(fh)
        except (OSError, ValueError):
            _cache = {}
    return _cache


def _persist(data: dict) -> None:
    try:
        os.makedirs(os.path.dirname(settings.instance_path), exist_ok=True)
        tmp = settings.instance_path + ".tmp"
        with open(tmp, "w") as fh:
            json.dump(data, fh)
        os.replace(tmp, settings.instance_path)
    except OSError:
        pass  # best-effort; we just re-learn on the next public request


def resolve_mail_domain(request: Request) -> str:
    """The canonical, stable domain for addresses like user@<domain>.

    Precedence: HOLISTIC_MAIL_DOMAIN override → persisted learned value → learn from the
    current request iff it arrived on a public host (then persist) → "" (no public domain
    seen yet; the email UI should prompt the operator to set HOLISTIC_MAIL_DOMAIN).
    """
    if settings.mail_domain:
        return settings.mail_domain
    with _lock:
        stored = _load().get("mail_domain", "")
        if stored:
            return stored
        host = request_host(request)
        if _is_public_host(host):
            data = dict(_load())
            data["mail_domain"] = host
            _cache.update(data)
            _persist(data)
            return host
    return ""
