from datetime import datetime

from beanie import Document, Insert, PydanticObjectId, Replace, before_event
from pydantic import Field

from app.models.common import utc_now


class Post(Document):
    thread_id: PydanticObjectId
    author_id: PydanticObjectId
    parent_post_id: PydanticObjectId | None = None

    content: str = Field(min_length=1)
    mentions: list[str] = Field(default_factory=list)
    likes: list[PydanticObjectId] = Field(default_factory=list)

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
        name = "posts"
        indexes = ["thread_id", "author_id", "parent_post_id", "created_at"]
