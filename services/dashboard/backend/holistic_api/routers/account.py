from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile

from ..accounts import profiles, provision
from ..accounts.models import PasswordChangeRequest, ProfileUpdate
from ..accounts.users import get_user_info
from ..auth import pam
from ..auth.deps import csrf_guard, current_user
from ..config import settings

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


@router.get("/profile")
def get_profile(user: dict = Depends(current_user)):
    # The shared user shape (effective displayName + first/last/email/avatar) plus the
    # RAW nickname override, so the editor seeds the actual stored value (not the OS fallback).
    data = dict(user)
    data["nickname"] = profiles.load(user["username"])["nickname"]
    return data


@router.put("/profile", dependencies=[Depends(csrf_guard)])
def update_profile(body: ProfileUpdate, user: dict = Depends(current_user)):
    profiles.save(user["username"], body.model_dump())
    return get_user_info(user["username"])


@router.post("/avatar", dependencies=[Depends(csrf_guard)])
async def upload_avatar(file: UploadFile = File(...), user: dict = Depends(current_user)):
    content = await file.read(settings.max_avatar_bytes + 1)
    if len(content) > settings.max_avatar_bytes:
        raise HTTPException(413, "Image is too large")
    try:
        profiles.save_avatar(user["username"], content)
    except ValueError:
        raise HTTPException(415, "Unsupported image type")
    return get_user_info(user["username"])


@router.delete("/avatar", dependencies=[Depends(csrf_guard)])
def delete_avatar(user: dict = Depends(current_user)):
    profiles.delete_avatar(user["username"])
    return get_user_info(user["username"])


@router.get("/avatar/{username}")
def get_avatar(username: str, _: dict = Depends(current_user)):
    # Any authenticated user may view another's photo (admin user lists, future shares).
    if not profiles.USER_RE.match(username):
        raise HTTPException(404, "No avatar")
    content = profiles.read_avatar(username)
    if content is None:
        raise HTTPException(404, "No avatar")
    return Response(
        content,
        media_type=profiles.avatar_mime(username),
        headers={"Cache-Control": "private, max-age=300"},
    )
