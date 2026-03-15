from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.thread import ThreadStatus


class ThreadCreate(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    body: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)
    author_id: str | None = None


class ThreadUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=160)
    body: str | None = Field(default=None, min_length=1)
    tags: list[str] | None = None
    status: ThreadStatus | None = None


class ThreadOut(BaseModel):
    id: str
    title: str
    body: str
    tags: list[str]
    author_id: str
    author_username: str | None = None
    author_display_name: str | None = None
    post_count: int
    like_count: int = 0
    liked_by_me: bool = False
    status: ThreadStatus
    is_pinned: bool
    author_is_bot: bool = False
    ai_score: float | None = None
    is_flagged: bool = False
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ThreadListResponse(BaseModel):
    data: list[ThreadOut]
    page: int
    limit: int
    total: int


class ReportRequest(BaseModel):
    reason: Literal["spam", "harassment", "misinformation", "nsfw", "other"]
    detail: str = Field(default="", max_length=500)
