from datetime import datetime
from enum import Enum

from beanie import Document, Insert, PydanticObjectId, Replace, before_event
from pydantic import BaseModel, EmailStr, Field

from app.models.common import utc_now


class UserRole(str, Enum):
    MEMBER = "member"
    MODERATOR = "moderator"
    ADMIN = "admin"


class AdminNote(BaseModel):
    note: str = Field(min_length=1, max_length=500)
    admin_id: PydanticObjectId
    created_at: datetime = Field(default_factory=utc_now)


class User(Document):
    username: str = Field(min_length=3, max_length=30)
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=80)
    bio: str | None = Field(default=None, max_length=280)
    password_hash: str | None = None

    role: UserRole = UserRole.MEMBER
    is_active: bool = True
    subscribed_channels: list[PydanticObjectId] = Field(default_factory=list)
    following: list[PydanticObjectId] = Field(default_factory=list)
    muted_users: list[PydanticObjectId] = Field(default_factory=list)
    blocked_user_ids: list[PydanticObjectId] = Field(default_factory=list)
    interest_tags: list[str] = Field(default_factory=list)
    hidden_tags: list[str] = Field(default_factory=list)
    topics_selected: bool = False
    admin_notes: list[AdminNote] = Field(default_factory=list)

    # Recovery / security questions (all stored hashed)
    recovery_code_hash: str | None = None
    fav_animal_hash: str | None = None
    fav_person_hash: str | None = None

    first_name: str | None = Field(default=None, max_length=50)
    last_name: str | None = Field(default=None, max_length=50)
    gender: str | None = Field(default=None, max_length=30)

    # Profile slug — separate from username, user-changeable vanity URL
    profile_slug: str | None = Field(default=None, max_length=30)
    profile_slug_changed_at: datetime | None = None

    is_bot: bool = False
    avatar_url: str | None = None

    # Security fields
    login_attempts: int = 0
    locked_until: datetime | None = None
    last_login: datetime | None = None
    password_changed_at: datetime | None = None
    force_password_change: bool = False

    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @before_event([Insert, Replace])
    def update_timestamps(self) -> None:
        now = utc_now()
        if self.created_at is None:
            self.created_at = now
        self.updated_at = now

    class Settings:
        name = "users"
        indexes = ["username", "email", "profile_slug", "following", "muted_users", "blocked_user_ids", "interest_tags", "hidden_tags"]
