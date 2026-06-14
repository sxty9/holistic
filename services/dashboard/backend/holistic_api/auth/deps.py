"""FastAPI dependencies: current_user, require_admin, require_permission, csrf_guard."""
from __future__ import annotations

from typing import Callable

import jwt
from fastapi import Depends, HTTPException, Request

from ..accounts.users import get_user_info
from . import tokens
from .cookies import ACCESS, CSRF


def current_user(request: Request) -> dict:
    token = request.cookies.get(ACCESS)
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        data = tokens.decode(token, "access")
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired session")
    try:
        return get_user_info(data["sub"])
    except KeyError:
        raise HTTPException(401, "Account no longer exists")


def require_admin(user: dict = Depends(current_user)) -> dict:
    if not user.get("isAdmin"):
        raise HTTPException(403, "Administrator access required")
    return user


def require_permission(group: str) -> Callable[..., dict]:
    """Gate by the holistic rights standard: pass if the user is admin OR belongs to
    the backing Linux group. Additive — on a host without privleg the hp_* groups are
    empty, so this reduces to admin-only (identical to pre-rights-standard behaviour)."""

    def dep(user: dict = Depends(current_user)) -> dict:
        if user.get("isAdmin") or group in user.get("groups", []):
            return user
        raise HTTPException(403, "You do not have permission for this action")

    return dep


def csrf_guard(request: Request) -> None:
    header = request.headers.get("X-CSRF-Token")
    cookie = request.cookies.get(CSRF)
    if not header or not cookie or header != cookie:
        raise HTTPException(403, "CSRF check failed")
