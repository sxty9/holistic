from __future__ import annotations

import grp

from fastapi import APIRouter, Depends, HTTPException, Response

from ..accounts import invites, provision
from ..accounts.users import get_user_info
from ..auth.deps import csrf_guard, require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/users")
def list_users():
    try:
        members = set(grp.getgrnam("smbusers").gr_mem)
    except KeyError:
        members = set()
    out = []
    for name in sorted(members):
        try:
            out.append(get_user_info(name))
        except KeyError:
            continue
    return out


@router.delete("/users/{username}", status_code=204, dependencies=[Depends(csrf_guard)])
def delete_user(username: str, purge: bool = False, admin: dict = Depends(require_admin)):
    if username == admin["username"]:
        raise HTTPException(400, "You cannot delete your own account")
    try:
        provision.delete_user(username, purge=purge)
    except provision.ProvisionError:
        raise HTTPException(500, "Could not delete the account")
    return Response(status_code=204)


@router.get("/invites")
def list_invites():
    return invites.list_invites()
