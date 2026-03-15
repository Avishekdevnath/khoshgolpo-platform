from datetime import date, datetime

from beanie import Document, Insert, PydanticObjectId, Replace, before_event
from pydantic import BaseModel, Field

from app.models.common import utc_now


class FeedWeights(BaseModel):
    follow: float = Field(default=0.45, ge=0.0, le=2.0)
    recency: float = Field(default=0.25, ge=0.0, le=2.0)
    engagement: float = Field(default=0.15, ge=0.0, le=2.0)
    interest: float = Field(default=0.10, ge=0.0, le=2.0)
    pin: float = Field(default=0.05, ge=0.0, le=2.0)
    quality_penalty: float = Field(default=0.20, ge=0.0, le=2.0)
    ai_adjustment_cap: float = Field(default=0.25, ge=0.0, le=1.0)


class FeedConfig(Document):
    version: int = 1
    weights: FeedWeights = Field(default_factory=FeedWeights)
    ai_enabled: bool = False
    ai_timeout_ms: int = Field(default=800, ge=100, le=5000)
    ai_daily_budget_usd: float = Field(default=5.0, ge=0.0, le=5000.0)
    ai_spend_today_usd: float = Field(default=0.0, ge=0.0, le=5000.0)
    ai_requests_count: int = Field(default=0, ge=0)
    ai_timeout_count: int = Field(default=0, ge=0)
    ai_error_count: int = Field(default=0, ge=0)
    ai_fallback_count: int = Field(default=0, ge=0)
    ai_last_reset: date = Field(default_factory=lambda: utc_now().date())
    updated_by: PydanticObjectId | None = None
    updated_at: datetime = Field(default_factory=utc_now)

    @before_event([Insert, Replace])
    def touch_updated_at(self) -> None:
        self.updated_at = utc_now()

    class Settings:
        name = "feed_config"
        indexes = [
            "updated_at",
            "ai_last_reset",
        ]
