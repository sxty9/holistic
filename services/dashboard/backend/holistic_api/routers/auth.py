from __future__ import annotations

import re

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from ..accounts import invites, provision
from ..accounts.models import LoginRequest, RegisterRequest
from ..accounts.users import get_user_info, user_exists
from ..auth import pam, sessions, tokens
from ..auth.cookies import REFRESH, clear_session, set_session
from ..auth.deps import current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])
USER_RE = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")


def _session_response(username: str) -> JSONResponse:
    access = tokens.issue_access(username)
    refresh, _sid = tokens.issue_refresh(username)
    csrf = tokens.new_csrf()
    resp = JSONResponse(get_user_info(username))
    set_session(resp, access, refresh, csrf)
    return resp


@router.post("/login")
def login(body: LoginRequest):
    if not pam.authenticate(body.username, body.password):
        raise HTTPException(401, "Invalid username or password")
    return _session_response(body.username)


@router.post("/register")
def register(body: RegisterRequest):
    if not USER_RE.match(body.username):
        raise HTTPException(400, "Invalid username")
    if not body.password:
        raise HTTPException(400, "Password required")
    invite_id = invites.find_active(body.invite_code)
    if not invite_id:
        raise HTTPException(403, "Invalid or already-used invite code")
    if user_exists(body.username):
        raise HTTPException(409, "That username is taken")
    # Claim the invite first (atomic) so one code can't create two accounts.
    if not invites.consume(invite_id, body.username):
        raise HTTPException(403, "Invite is no longer valid")
    try:
        provision.create_user(body.username, body.password, body.display_name)
    except provision.ProvisionError as e:
        if e.code == "exists":
            raise HTTPException(409, "That username is taken")
        raise HTTPException(500, "Could not create the account")
    return _session_response(body.username)


@router.post("/refresh")
def refresh(request: Request):
    tok = request.cookies.get(REFRESH)
    if not tok:
        raise HTTPException(401, "No session")
    try:
        data = tokens.decode(tok, "refresh")
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid session")
    if sessions.is_revoked(data["sid"]):
        raise HTTPException(401, "Session expired")
    if not user_exists(data["sub"]):
        raise HTTPException(401, "Account no longer exists")
    sessions.revoke(data["sid"])  # rotate
    return _session_response(data["sub"])


@router.post("/logout", status_code=204)
def logout(request: Request):
    tok = request.cookies.get(REFRESH)
    if tok:
        try:
            sessions.revoke(tokens.decode(tok, "refresh")["sid"])
        except jwt.PyJWTError:
            pass
    resp = Response(status_code=204)
    clear_session(resp)
    return resp


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return user
