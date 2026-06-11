"""Validate a username+password against the live Linux system via PAM.

pam_unix verifies /etc/shadow through the setuid `unix_chkpwd` helper, so this works
from the unprivileged backend without ever reading shadow itself.
"""
from __future__ import annotations

from ..config import settings


def authenticate(username: str, password: str) -> bool:
    if not username or not password:
        return False
    if settings.dev_fake_pam:
        return True  # DEV ONLY — accept any non-empty credentials
    import pam as pam_module

    return bool(pam_module.pam().authenticate(username, password, service=settings.pam_service))
