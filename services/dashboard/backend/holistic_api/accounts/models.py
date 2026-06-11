from __future__ import annotations

from pydantic import BaseModel


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


class UserProfile(BaseModel):
    username: str
    displayName: str
    groups: list[str]
    isAdmin: bool
