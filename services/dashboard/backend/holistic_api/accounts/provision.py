"""Bridge to the privileged user wrappers. Passwords go via stdin, never argv."""
from __future__ import annotations

import subprocess

from ..config import settings
from . import users


class ProvisionError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def _run_with_password(argv: list[str], password: str) -> subprocess.CompletedProcess:
    return subprocess.run(argv, input=(password + "\n").encode(), capture_output=True)


def create_user(username: str, password: str, display_name: str) -> None:
    if settings.dev_fake_provision:
        first = len(users._DEV_USERS) == 0
        users.dev_register(username, display_name, admin=first)
        return
    r = _run_with_password(["sudo", "-n", settings.user_add, username, display_name], password)
    if r.returncode == 3:
        raise ProvisionError("exists", "user already exists")
    if r.returncode != 0:
        raise ProvisionError("failed", r.stderr.decode("utf-8", "replace")[:200])


def change_password(username: str, password: str) -> None:
    if settings.dev_fake_provision:
        return
    r = _run_with_password(["sudo", "-n", settings.user_passwd, username], password)
    if r.returncode != 0:
        raise ProvisionError("failed", r.stderr.decode("utf-8", "replace")[:200])


def delete_user(username: str, purge: bool = False) -> None:
    if settings.dev_fake_provision:
        users._DEV_USERS.pop(username, None)
        return
    argv = ["sudo", "-n", settings.user_delete, username] + (["--purge"] if purge else [])
    r = subprocess.run(argv, capture_output=True)
    if r.returncode != 0:
        raise ProvisionError("failed", r.stderr.decode("utf-8", "replace")[:200])
