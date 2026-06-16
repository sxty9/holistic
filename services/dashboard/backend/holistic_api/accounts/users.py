"""Read Linux account identity — the single source of truth for who a user is."""
from __future__ import annotations

import grp
import os
import pwd

from ..config import settings
from . import profiles

# In dev (fake provision) we keep an in-memory registry so /auth/me works without real accounts.
_DEV_USERS: dict[str, dict] = {}


def _with_profile(info: dict) -> dict:
    """Overlay the app-managed profile: a chosen nickname wins over the OS display name,
    and the extra fields (first/last name, email, avatar URL) are attached."""
    name = info["username"]
    prof = profiles.load(name)
    if prof["nickname"]:
        info["displayName"] = prof["nickname"]
    info["firstName"] = prof["firstName"]
    info["lastName"] = prof["lastName"]
    info["email"] = prof["email"]
    info["avatarUrl"] = profiles.avatar_url(name)
    return info


def dev_register(username: str, display_name: str, admin: bool = False) -> None:
    _DEV_USERS[username] = {"displayName": display_name or username, "isAdmin": admin}


def _seed_dev_admins() -> None:
    """Preview/sandbox convenience: with fake provisioning, pre-register the usernames in
    HOLISTIC_DEV_ADMINS as admins so a preview needs NO registration — an admin just logs in
    as themselves (fake PAM accepts any password). A no-op in production (dev_fake_provision
    is off there), so it is safe to ship."""
    if not settings.dev_fake_provision:
        return
    for name in (n.strip() for n in os.environ.get("HOLISTIC_DEV_ADMINS", "").replace(",", " ").split()):
        if name and name not in _DEV_USERS:
            dev_register(name, name, admin=True)


_seed_dev_admins()


def user_exists(username: str) -> bool:
    if settings.dev_fake_provision:
        return username in _DEV_USERS
    try:
        pwd.getpwnam(username)
        return True
    except KeyError:
        return False


def get_user_info(username: str) -> dict:
    """Return {username, displayName, groups, isAdmin} from the OS (or the dev registry)."""
    if settings.dev_fake_provision:
        d = _DEV_USERS.get(username, {"displayName": username, "isAdmin": False})
        groups = ["family", "smbusers"] + ([settings.admin_group] if d["isAdmin"] else [])
        return _with_profile({"username": username, "displayName": d["displayName"], "groups": groups, "isAdmin": d["isAdmin"]})

    pw = pwd.getpwnam(username)
    primary = grp.getgrgid(pw.pw_gid).gr_name
    groups = {primary}
    try:
        for gid in os.getgrouplist(username, pw.pw_gid):
            groups.add(grp.getgrgid(gid).gr_name)
    except (KeyError, OSError):
        for g in grp.getgrall():
            if username in g.gr_mem:
                groups.add(g.gr_name)
    display = (pw.pw_gecos or "").split(",")[0].strip() or username
    return _with_profile({
        "username": username,
        "displayName": display,
        "groups": sorted(groups),
        "isAdmin": settings.admin_group in groups,
    })
