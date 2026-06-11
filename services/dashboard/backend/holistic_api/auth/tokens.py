"""JWT issue/verify for the access + refresh cookie session."""
from __future__ import annotations

import secrets
import time

import jwt

from ..config import settings


def _now() -> int:
    return int(time.time())


def issue_access(username: str) -> str:
    return jwt.encode({"sub": username, "type": "access", "exp": _now() + settings.access_ttl}, settings.secret, algorithm="HS256")


def issue_refresh(username: str, sid: str | None = None) -> tuple[str, str]:
    sid = sid or secrets.token_hex(16)
    token = jwt.encode({"sub": username, "type": "refresh", "sid": sid, "exp": _now() + settings.refresh_ttl}, settings.secret, algorithm="HS256")
    return token, sid


def decode(token: str, expected_type: str) -> dict:
    data = jwt.decode(token, settings.secret, algorithms=["HS256"])
    if data.get("type") != expected_type:
        raise jwt.InvalidTokenError("wrong token type")
    return data


def new_csrf() -> str:
    return secrets.token_hex(16)
