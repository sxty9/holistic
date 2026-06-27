from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ...auth.deps import csrf_guard, current_user, require_permission
from ...config import settings
from . import fsclient, paths

router = APIRouter(prefix="/api/services/samba", tags=["samba"])

# Fine-grained Files rights (holistic rights standard):
#   • view (default-ON):  open Files + read/download anywhere. Gates every read endpoint and
#     the sidebar tab — without it the Files app is empty overhead.
#   • edit (default-ON):  create/change/upload/move/delete in one's OWN (private "me") space.
#   • family-write (default-OFF): the same, but for the SHARED "family" space (opt-in).
# Admins bypass all three. A read gate is applied per-endpoint via require_permission(view);
# write gates are per-target (a single op may touch both private and shared paths).
SAMBA_VIEW = "hp_samba_view"
SAMBA_EDIT = "hp_samba_edit"
SAMBA_FAMILY_WRITE = "hp_samba_family_write"

# Dependency: every read endpoint requires the view right (admin or hp_samba_view).
require_view = require_permission(SAMBA_VIEW)


def _root_key(vpath: str) -> str:
    return vpath.strip("/").split("/", 1)[0]


def _require_write(user: dict, *vpaths: str) -> None:
    """403 unless the user may write every target: the shared Family space needs
    hp_samba_family_write; any other (private) location needs hp_samba_edit. Admins bypass."""
    if user.get("isAdmin"):
        return
    groups = user.get("groups", [])
    for v in vpaths:
        if _root_key(v) == "family":
            if SAMBA_FAMILY_WRITE not in groups:
                raise HTTPException(403, "You do not have permission to modify the shared Family space")
        elif SAMBA_EDIT not in groups:
            raise HTTPException(403, "You do not have permission to edit files")


def _abspath(user: str, vpath: str) -> str:
    try:
        return paths.resolve_virtual(user, vpath)
    except paths.PathError:
        raise HTTPException(400, "Invalid path")


def _fs_http(e: fsclient.FsError) -> HTTPException:
    return HTTPException({3: 403, 4: 404, 5: 409, 2: 400}.get(e.code, 500), str(e) or "File operation failed")


def _with_path(entry: dict, vpath: str) -> dict:
    entry["path"] = vpath
    return entry


# --- read ---------------------------------------------------------------

@router.get("/fs/roots")
def fs_roots(user: dict = Depends(require_view)):
    # Report writability per root from the user's rights so the Files UI shows the right
    # locations as read-only (it gates its write actions on root.writable).
    admin = user.get("isAdmin", False)
    groups = user.get("groups", [])
    writable = {"me": admin or SAMBA_EDIT in groups, "family": admin or SAMBA_FAMILY_WRITE in groups}
    roots = paths.list_roots(user["username"])
    for r in roots:
        r["writable"] = writable.get(r["key"], r["writable"])
    return roots


@router.get("/fs/list")
def fs_list(path: str, user: dict = Depends(require_view)):
    abspath = _abspath(user["username"], path)
    base = paths.virtual_base(path)
    try:
        data = fsclient.run_json(user["username"], "list", abspath)
    except fsclient.FsError as e:
        raise _fs_http(e)
    entries = [_with_path(e, f"{base}/{e['name']}") for e in data.get("entries", [])]
    return {"path": base, "entries": entries}


@router.get("/fs/stat")
def fs_stat(path: str, user: dict = Depends(require_view)):
    abspath = _abspath(user["username"], path)
    try:
        return _with_path(fsclient.run_json(user["username"], "stat", abspath), paths.virtual_base(path))
    except fsclient.FsError as e:
        raise _fs_http(e)


def _serve(user: str, vpath: str, request: Request, inline: bool):
    abspath = _abspath(user, vpath)
    try:
        meta = fsclient.run_json(user, "stat", abspath)
    except fsclient.FsError as e:
        raise _fs_http(e)
    if meta["kind"] != "file":
        raise HTTPException(400, "Not a file")
    size = int(meta["size"])
    mime = meta.get("mime") or "application/octet-stream"
    name = meta["name"].replace('"', "")

    start, end, status = 0, size - 1, 200
    rng = request.headers.get("range")
    if rng and rng.startswith("bytes=") and size > 0:
        try:
            s, _, e = rng[6:].partition("-")
            start = int(s) if s else 0
            end = int(e) if e else size - 1
            end = min(end, size - 1)
            if start > end:
                raise ValueError
            status = 206
        except ValueError:
            raise HTTPException(416, "Invalid range")
    length = end - start + 1 if size else 0

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(length),
        "ETag": f'"{meta["mtime"]}-{size}"',
        "Content-Disposition": f'{"inline" if inline else "attachment"}; filename="{name}"',
    }
    if status == 206:
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    gen = fsclient.stream(user, abspath, offset=start, length=length)
    return StreamingResponse(gen, status_code=status, media_type=mime, headers=headers)


@router.get("/fs/download")
def fs_download(path: str, request: Request, user: dict = Depends(require_view)):
    return _serve(user["username"], path, request, inline=False)


@router.get("/fs/raw")
def fs_raw(path: str, request: Request, user: dict = Depends(require_view)):
    return _serve(user["username"], path, request, inline=True)


@router.get("/fs/text")
def fs_text(path: str, user: dict = Depends(require_view)):
    abspath = _abspath(user["username"], path)
    try:
        meta = fsclient.run_json(user["username"], "stat", abspath)
        if meta["kind"] != "file":
            raise HTTPException(400, "Not a file")
        if meta.get("viewer") not in ("text", "markdown"):
            raise HTTPException(415, "Not a text file")
        data = b"".join(fsclient.stream(user["username"], abspath, offset=0, length=settings.max_text_bytes + 1))
    except fsclient.FsError as e:
        raise _fs_http(e)
    truncated = len(data) > settings.max_text_bytes
    return {"content": data[: settings.max_text_bytes].decode("utf-8", "replace"), "truncated": truncated, "encoding": "utf-8"}


# --- mutations (CSRF-guarded) ------------------------------------------

class MkdirBody(BaseModel):
    path: str
    name: str


class RenameBody(BaseModel):
    path: str
    newName: str


class MoveBody(BaseModel):
    src: str
    dstDir: str


class DeleteBody(BaseModel):
    path: str
    recursive: bool = False


@router.post("/fs/mkdir", dependencies=[Depends(csrf_guard)])
def fs_mkdir(body: MkdirBody, user: dict = Depends(current_user)):
    _require_write(user, body.path)
    parent = _abspath(user["username"], body.path)
    target = os.path.join(parent, os.path.basename(body.name))
    try:
        return _with_path(fsclient.run_json(user["username"], "mkdir", target), f"{paths.virtual_base(body.path)}/{body.name}")
    except fsclient.FsError as e:
        raise _fs_http(e)


@router.post("/fs/rename", dependencies=[Depends(csrf_guard)])
def fs_rename(body: RenameBody, user: dict = Depends(current_user)):
    _require_write(user, body.path)
    abspath = _abspath(user["username"], body.path)
    try:
        return fsclient.run_json(user["username"], "rename", abspath, body.newName)
    except fsclient.FsError as e:
        raise _fs_http(e)


@router.post("/fs/move", dependencies=[Depends(csrf_guard)])
def fs_move(body: MoveBody, user: dict = Depends(current_user)):
    _require_write(user, body.src, body.dstDir)  # move both reads from src and writes to dst
    src = _abspath(user["username"], body.src)
    dstdir = _abspath(user["username"], body.dstDir)
    try:
        return fsclient.run_json(user["username"], "move", src, dstdir)
    except fsclient.FsError as e:
        raise _fs_http(e)


@router.post("/fs/copy", dependencies=[Depends(csrf_guard)])
def fs_copy(body: MoveBody, user: dict = Depends(current_user)):
    _require_write(user, body.dstDir)  # copy only writes to dst; reading src is allowed
    src = _abspath(user["username"], body.src)
    dstdir = _abspath(user["username"], body.dstDir)
    try:
        return fsclient.run_json(user["username"], "copy", src, dstdir)
    except fsclient.FsError as e:
        raise _fs_http(e)


@router.post("/fs/delete", dependencies=[Depends(csrf_guard)])
def fs_delete(body: DeleteBody, user: dict = Depends(current_user)):
    _require_write(user, body.path)
    abspath = _abspath(user["username"], body.path)
    args = [abspath]
    if body.recursive:
        args.append("--recursive")
    try:
        return fsclient.run_json(user["username"], "delete", *args)
    except fsclient.FsError as e:
        raise _fs_http(e)


@router.post("/fs/upload", dependencies=[Depends(csrf_guard)])
def fs_upload(path: str = Form(...), file: UploadFile = Form(...), user: dict = Depends(current_user)):
    _require_write(user, path)
    parent = _abspath(user["username"], path)
    target = os.path.join(parent, os.path.basename(file.filename or "upload"))
    try:
        written = fsclient.write_stream(user["username"], target, file.file, settings.max_upload_bytes)
    except fsclient.FsError as e:
        raise _fs_http(e)
    return {"written": [written]}
