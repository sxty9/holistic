"""Session cookie helpers (HttpOnly access/refresh + readable CSRF double-submit token)."""
from __future__ import annotations

from fastapi import Response

from ..config import settings

ACCESS = "h_access"
REFRESH = "h_refresh"
CSRF = "h_csrf"


def set_session(resp: Response, access: str, refresh: str, csrf: str) -> None:
    common = {"secure": settings.cookie_secure, "samesite": "lax"}
    resp.set_cookie(ACCESS, access, httponly=True, max_age=settings.access_ttl, path="/", **common)
    resp.set_cookie(REFRESH, refresh, httponly=True, max_age=settings.refresh_ttl, path="/api/auth", **common)
    # Readable by JS so the SPA can echo it as X-CSRF-Token (double-submit).
    resp.set_cookie(CSRF, csrf, httponly=False, max_age=settings.refresh_ttl, path="/", **common)


def clear_session(resp: Response) -> None:
    resp.delete_cookie(ACCESS, path="/")
    resp.delete_cookie(REFRESH, path="/api/auth")
    resp.delete_cookie(CSRF, path="/")
