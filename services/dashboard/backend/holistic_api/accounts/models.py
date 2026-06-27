from __future__ import annotations

from pydantic import BaseModel, field_validator


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
    nickname: str = ""

    @field_validator("firstName", "lastName", "nickname", mode="before")
    @classmethod
    def _to_str(cls, v: object) -> str:
        return ("" if v is None else str(v)).strip()


class UserProfile(BaseModel):
    username: str
    displayName: str
    groups: list[str]
    isAdmin: bool
    firstName: str = ""
    lastName: str = ""
    avatarUrl: str | None = None
