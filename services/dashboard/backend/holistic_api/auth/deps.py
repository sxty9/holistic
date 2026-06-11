"""FastAPI dependencies: current_user, require_admin, csrf_guard."""
from __future__ import annotations

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


def csrf_guard(request: Request) -> None:
    header = request.headers.get("X-CSRF-Token")
    cookie = request.cookies.get(CSRF)
    if not header or not cookie or header != cookie:
        raise HTTPException(403, "CSRF check failed")
