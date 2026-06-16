"""Validate a username+password against the live Linux system.

The backend runs as the unprivileged `holistic` user, which is NOT in group
`shadow`. In that process pam_unix cannot read /etc/shadow and falls back to
the setgid-shadow helper `unix_chkpwd`, which lets a non-root caller verify
ONLY its own account — so authenticating any other Linux user from here always
fails. We therefore shell out to the root `holistic-pam-check` wrapper (via the
narrow sudoers allowlist); as root pam_unix reads /etc/shadow directly and that
restriction does not apply. The password is passed on stdin, never argv.
"""
from __future__ import annotations

import secrets
import subprocess

from ..config import settings


def authenticate(username: str, password: str) -> bool:
    if not username or not password:
        return False
    if settings.preview_password:
        # Public preview sandbox: a single shared secret is mandatory (constant-time compare).
        # Gates the public URL without an /etc/shadow check, so the sandbox stays unprivileged.
        # Takes precedence over dev_fake_pam so a preview is never an open-admin endpoint.
        return secrets.compare_digest(password, settings.preview_password)
    if settings.dev_fake_pam:
        return True  # DEV ONLY — accept any non-empty credentials
    r = subprocess.run(
        ["sudo", "-n", settings.pam_check, username],
        input=(password + "\n").encode(),
        capture_output=True,
    )
    return r.returncode == 0
