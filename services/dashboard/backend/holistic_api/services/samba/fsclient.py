"""Invoke the holistic-fs broker AS the logged-in user (sudo -u), or directly in dev."""
from __future__ import annotations

import json
import os
import subprocess
from collections.abc import Iterator

from ...config import settings

CHUNK = 1024 * 1024


class FsError(Exception):
    def __init__(self, code: int, message: str):
        self.code = code
        super().__init__(message)


def _argv(user: str, op: str, *args: str) -> list[str]:
    if settings.dev_fs_direct:
        return ["python3", settings.fs_broker, op, *args]
    return ["sudo", "-n", "-u", user, settings.fs_broker, op, *args]


def _env(user: str) -> dict | None:
    if not settings.dev_fs_direct:
        return None
    e = os.environ.copy()
    e["HOLISTIC_FS_USER"] = user
    e["HOLISTIC_USERS_ROOT"] = settings.users_root
    e["HOLISTIC_FAMILY_ROOT"] = settings.family_root
    return e


def run_json(user: str, op: str, *args: str) -> dict:
    r = subprocess.run(_argv(user, op, *args), capture_output=True, env=_env(user))
    if r.returncode != 0:
        raise FsError(r.returncode, r.stderr.decode("utf-8", "replace").strip()[:200])
    return json.loads(r.stdout or b"{}")


def stream(user: str, abspath: str, offset: int | None = None, length: int | None = None) -> Iterator[bytes]:
    args = [abspath]
    if offset is not None:
        args += ["--offset", str(offset)]
    if length is not None:
        args += ["--length", str(length)]
    proc = subprocess.Popen(_argv(user, "read", *args), stdout=subprocess.PIPE, env=_env(user))
    assert proc.stdout is not None
    try:
        while True:
            chunk = proc.stdout.read(CHUNK)
            if not chunk:
                break
            yield chunk
    finally:
        proc.stdout.close()
        proc.wait()


def write_stream(user: str, abspath: str, src, max_bytes: int) -> dict:
    proc = subprocess.Popen(_argv(user, "write", abspath), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=_env(user))
    assert proc.stdin is not None
    written = 0
    try:
        while True:
            chunk = src.read(CHUNK)
            if not chunk:
                break
            written += len(chunk)
            if written > max_bytes:
                proc.stdin.close()
                proc.kill()
                proc.wait()
                raise FsError(2, "file too large")
            proc.stdin.write(chunk)
        proc.stdin.close()
    except BrokenPipeError:
        pass
    out, err = proc.communicate()
    if proc.returncode != 0:
        raise FsError(proc.returncode, err.decode("utf-8", "replace").strip()[:200])
    return json.loads(out or b"{}")
