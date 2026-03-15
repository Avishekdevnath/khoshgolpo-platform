from datetime import datetime
from typing import Literal

from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field

from app.models.common import utc_now

JobStatus = Literal["queued", "running", "completed", "completed_with_errors", "failed"]
ReplaceMode = Literal["merge", "replace"]
UserResultStatus = Literal["success", "fallback", "failed", "budget_exceeded"]


class FeedInterestSuggestionResult(BaseModel):
    user_id: PydanticObjectId
    status: UserResultStatus
    suggested_tags: list[str] = Field(default_factory=list)
    applied_tags: list[str] = Field(default_factory=list)
    error: str | None = None


class FeedInterestSuggestionJob(Document):
    status: JobStatus = "queued"
    requested_user_ids: list[PydanticObjectId] = Field(default_factory=list)
    replace_mode: ReplaceMode = "merge"
    max_tags_per_user: int = Field(default=8, ge=1, le=15)

    requested_count: int = 0
    processed_count: int = 0
    success_count: int = 0
    failed_count: int = 0

    results: list[FeedInterestSuggestionResult] = Field(default_factory=list)
    created_by: PydanticObjectId
    created_at: datetime = Field(default_factory=utc_now)
    started_at: datetime | None = None
    finished_at: datetime | None = None

    class Settings:
        name = "feed_interest_suggestion_jobs"
        indexes = [
            "status",
            "created_by",
            "created_at",
            "finished_at",
        ]
