from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=80)
    bio: str | None = Field(default=None, max_length=280)


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    bio: str | None = Field(default=None, max_length=280)
    first_name: str | None = Field(default=None, max_length=50)
    last_name: str | None = Field(default=None, max_length=50)
    gender: str | None = Field(default=None, max_length=30)


class UserOut(BaseModel):
    id: str
    username: str
    email: EmailStr
    display_name: str
    bio: str | None
    role: UserRole
    is_active: bool
    is_bot: bool = False
    first_name: str | None = None
    last_name: str | None = None
    gender: str | None = None
    profile_slug: str | None = None
    profile_slug_changed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
