import uuid
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field


def _not_blank(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Please enter a name.")
    return value


DisplayName = Annotated[str, Field(min_length=1, max_length=100), AfterValidator(_not_blank)]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: DisplayName


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class DisplayNameUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: DisplayName


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class AccountDelete(BaseModel):
    model_config = ConfigDict(extra="forbid")

    password: str = Field(min_length=1, max_length=128)


class ForgotPassword(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class ResetPassword(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=10, max_length=200)
    new_password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    display_name: str
