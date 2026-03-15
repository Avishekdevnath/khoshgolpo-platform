from datetime import datetime
from enum import Enum

from beanie import Document, Insert, PydanticObjectId, Replace, before_event
from pydantic import Field

from app.models.common import utc_now


class ThreadStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    ARCHIVED = "archived"


class Thread(Document):
    title: str = Field(min_length=3, max_length=160)
    body: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)

    author_id: PydanticObjectId
    likes: list[PydanticObjectId] = Field(default_factory=list)
    post_count: int = 0
    status: ThreadStatus = ThreadStatus.OPEN
    is_pinned: bool = False
    feed_boost: float = 0.0
    feed_suppressed: bool = False
    ai_score: float | None = None
    is_flagged: bool = False
    is_deleted: bool = False

    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @before_event([Insert, Replace])
    def update_timestamps(self) -> None:
        now = utc_now()
        if self.created_at is None:
            self.created_at = now
        self.updated_at = now

    class Settings:
        name = "threads"
        indexes = [
            "author_id",
            "tags",
            "created_at",
            "status",
            "is_pinned",
            "feed_boost",
            "feed_suppressed",
            "is_flagged",
            "is_deleted",
        ]
