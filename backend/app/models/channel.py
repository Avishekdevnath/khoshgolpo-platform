from datetime import datetime

from beanie import Document, Insert, Replace, before_event
from pydantic import Field

from app.models.common import utc_now


class Channel(Document):
    name: str = Field(min_length=1, max_length=60)
    slug: str = Field(min_length=1, max_length=60)
    tag: str = Field(min_length=1, max_length=40)
    description: str = Field(default="", max_length=280)
    color: str = Field(default="#9BA3BE", max_length=10)
    is_default: bool = False

    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @before_event([Insert, Replace])
    def update_timestamps(self) -> None:
        now = utc_now()
        if self.created_at is None:
            self.created_at = now
        self.updated_at = now

    class Settings:
        name = "channels"
        indexes = ["slug", "tag"]
