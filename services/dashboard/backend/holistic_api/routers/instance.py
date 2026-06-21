"""GET /api/instance — the single source of truth for "which domain am I served on?".

Consumed by the SPA shell and by every (current/future) service so nobody re-derives the
domain on their own. Unauthenticated on purpose: it carries nothing secret and the login
screen needs it before there is a session (mirrors /api/health).
"""
from __future__ import annotations

from fastapi import APIRouter, Request

from ..instance import request_host, request_origin, resolve_mail_domain

router = APIRouter(prefix="/api/instance", tags=["instance"])


@router.get("")
def instance(request: Request):
    return {
        "origin": request_origin(request),
        "host": request_host(request),
        "mailDomain": resolve_mail_domain(request),  # "" until a public domain is seen
    }
