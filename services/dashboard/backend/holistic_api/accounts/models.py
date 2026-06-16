from __future__ import annotations

import re

from pydantic import BaseModel, field_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: str = ""
    invite_code: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class ProfileUpdate(BaseModel):
    firstName: str = ""
    lastName: str = ""
    email: str = ""
    nickname: str = ""

    @field_validator("firstName", "lastName", "email", "nickname", mode="before")
    @classmethod
    def _to_str(cls, v: object) -> str:
        return ("" if v is None else str(v)).strip()

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        if v and not _EMAIL_RE.match(v):
            raise ValueError("invalid email address")
        return v


class UserProfile(BaseModel):
    username: str
    displayName: str
    groups: list[str]
    isAdmin: bool
    firstName: str = ""
    lastName: str = ""
    email: str = ""
    avatarUrl: str | None = None
