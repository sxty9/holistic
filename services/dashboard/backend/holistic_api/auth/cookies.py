"""Session cookie helpers (HttpOnly access/refresh + readable CSRF double-submit token)."""
from __future__ import annotations

from fastapi import Response

from .. import live_config
from ..config import settings

ACCESS = "h_access"
REFRESH = "h_refresh"
CSRF = "h_csrf"


def set_session(resp: Response, access: str, refresh: str, csrf: str) -> None:
    common = {"secure": settings.cookie_secure, "samesite": "lax"}
    if settings.cookie_domain:
        common["domain"] = settings.cookie_domain
        # Evict any stale host-only variant left over from before the domain rollout, so the
        # browser does not carry a duplicate (host-only + domain) pair where the stale one can
        # shadow the fresh cookie on parse.
        for name, path in ((ACCESS, "/"), (REFRESH, "/api/auth"), (CSRF, "/")):
            resp.delete_cookie(name, path=path)
    access_ttl, refresh_ttl = live_config.access_ttl(), live_config.refresh_ttl()
    resp.set_cookie(ACCESS, access, httponly=True, max_age=access_ttl, path="/", **common)
    resp.set_cookie(REFRESH, refresh, httponly=True, max_age=refresh_ttl, path="/api/auth", **common)
    # Readable by JS so the SPA can echo it as X-CSRF-Token (double-submit).
    resp.set_cookie(CSRF, csrf, httponly=False, max_age=refresh_ttl, path="/", **common)


def clear_session(resp: Response) -> None:
    # Clear both the host-only (legacy) and the domain-scoped variants so neither lingers
    # through a rollout of HOLISTIC_COOKIE_DOMAIN.
    for name, path in ((ACCESS, "/"), (REFRESH, "/api/auth"), (CSRF, "/")):
        resp.delete_cookie(name, path=path)
        if settings.cookie_domain:
            resp.delete_cookie(name, path=path, domain=settings.cookie_domain)
