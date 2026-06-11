from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response

from ..accounts import provision
from ..accounts.models import PasswordChangeRequest
from ..auth import pam
from ..auth.deps import csrf_guard, current_user

router = APIRouter(prefix="/api/account", tags=["account"])


@router.post("/password", status_code=204, dependencies=[Depends(csrf_guard)])
def change_password(body: PasswordChangeRequest, user: dict = Depends(current_user)):
    # Re-authenticate so a stolen cookie alone cannot change the password.
    if not pam.authenticate(user["username"], body.current_password):
        raise HTTPException(401, "Your current password is wrong")
    if not body.new_password:
        raise HTTPException(400, "New password required")
    try:
        provision.change_password(user["username"], body.new_password)
    except provision.ProvisionError:
        raise HTTPException(500, "Could not update the password")
    return Response(status_code=204)
