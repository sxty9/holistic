"""Runtime settings, populated from environment with production-safe defaults."""
from __future__ import annotations

import os
import secrets
from dataclasses import dataclass, field


def _bool(name: str, default: bool = False) -> bool:
    v = os.environ.get(name)
    return default if v is None else v.lower() in ("1", "true", "yes", "on")


def _load_secret() -> str:
    path = os.environ.get("HOLISTIC_SECRET_FILE", "/etc/holistic/jwt-secret")
    try:
        with open(path) as fh:
            s = fh.read().strip()
            if s:
                return s
    except OSError:
        pass
    if (env := os.environ.get("HOLISTIC_SECRET")):
        return env
    # Ephemeral dev secret — sessions do not survive a restart.
    return secrets.token_hex(32)


@dataclass
class Settings:
    secret: str = field(default_factory=_load_secret)
    access_ttl: int = 900  # 15 min
    refresh_ttl: int = 7 * 86400

    pam_service: str = os.environ.get("HOLISTIC_PAM_SERVICE", "holistic-dashboard")
    # Admin = single Linux source of truth: membership in the sudo group (Ubuntu `sudo`;
    # `wheel` on RHEL). No parallel app-managed admin group.
    admin_group: str = os.environ.get("HOLISTIC_ADMIN_GROUP", "sudo")

    users_root: str = os.environ.get("HOLISTIC_USERS_ROOT", "/srv/storage/users")
    family_root: str = os.environ.get("HOLISTIC_FAMILY_ROOT", "/srv/storage/family")

    invites_path: str = os.environ.get("HOLISTIC_INVITES", "/var/lib/holistic/invites.json")
    revoked_path: str = os.environ.get("HOLISTIC_REVOKED", "/var/lib/holistic/revoked.json")
    # App-managed profile store (first/last name, email, nickname, avatar). Written by the
    # backend user directly, like invites — no OS-identity change, so no privileged wrapper.
    profiles_root: str = os.environ.get("HOLISTIC_PROFILES", "/var/lib/holistic/profiles")

    pam_check: str = os.environ.get("HOLISTIC_PAM_CHECK", "/usr/local/sbin/holistic-pam-check")
    fs_broker: str = os.environ.get("HOLISTIC_FS_BROKER", "/usr/local/sbin/holistic-fs")
    invite_consume: str = os.environ.get("HOLISTIC_INVITE_CONSUME", "/usr/local/sbin/holistic-invite-consume")
    user_add: str = os.environ.get("HOLISTIC_USER_ADD", "/usr/local/sbin/holistic-user-add")
    user_passwd: str = os.environ.get("HOLISTIC_USER_PASSWD", "/usr/local/sbin/holistic-user-passwd")
    user_delete: str = os.environ.get("HOLISTIC_USER_DELETE", "/usr/local/sbin/holistic-user-delete")

    cookie_secure: bool = _bool("HOLISTIC_COOKIE_SECURE", True)

    max_upload_bytes: int = int(os.environ.get("HOLISTIC_MAX_UPLOAD", str(20 * 1024**3)))
    max_avatar_bytes: int = int(os.environ.get("HOLISTIC_MAX_AVATAR", str(5 * 1024**2)))
    max_text_bytes: int = int(os.environ.get("HOLISTIC_MAX_TEXT", str(2 * 1024**2)))
    max_listing: int = int(os.environ.get("HOLISTIC_MAX_LISTING", "5000"))

    # Dev flags (NEVER enable in production):
    dev_fake_pam: bool = _bool("HOLISTIC_FAKE_PAM", False)
    dev_fake_provision: bool = _bool("HOLISTIC_FAKE_PROVISION", False)
    dev_fs_direct: bool = _bool("HOLISTIC_FS_DIRECT", False)  # run broker w/o sudo, as current user


settings = Settings()
