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
    and the extra fields (first/last name, avatar URL) are attached."""
    name = info["username"]
    prof = profiles.load(name)
    if prof["nickname"]:
        info["displayName"] = prof["nickname"]
    info["firstName"] = prof["firstName"]
    info["lastName"] = prof["lastName"]
    info["avatarUrl"] = profiles.avatar_url(name)
    return info


def _shell_enabled(shell: str) -> bool:
    """True if the login shell is a real shell (not nologin/false) — the source of truth for
    the shell-type right (remshel). Mirrors privleg's ShellEnabled."""
    shell = (shell or "").strip()
    return bool(shell) and os.path.basename(shell) not in ("nologin", "false")


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
        return _with_profile({"username": username, "displayName": d["displayName"], "groups": groups, "isAdmin": d["isAdmin"], "shellEnabled": True})

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
        "shellEnabled": _shell_enabled(pw.pw_shell),
    })


# Every provisioned holistic user joins this group, so its membership IS the user roster (the same
# group the dev branch of get_user_info seeds). Kept next to the single per-user accessor so "who
# the users are" has exactly one home.
_ROSTER_GROUP = "smbusers"


def list_users() -> list[dict]:
    """Every holistic user, each resolved through get_user_info — the single accessor for the user
    roster, so callers (e.g. the admin API) build on this instead of scanning passwd/groups on
    their own. In dev (fake provisioning) the roster is the in-memory registry."""
    if settings.dev_fake_provision:
        names = sorted(_DEV_USERS)
    else:
        try:
            names = sorted(set(grp.getgrnam(_ROSTER_GROUP).gr_mem))
        except KeyError:
            names = []
    out = []
    for name in names:
        try:
            out.append(get_user_info(name))
        except KeyError:
            continue
    return out
