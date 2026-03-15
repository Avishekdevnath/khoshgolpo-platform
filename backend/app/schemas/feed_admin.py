from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class FeedWeightsOut(BaseModel):
    follow: float
    recency: float
    engagement: float
    interest: float
    pin: float
    quality_penalty: float
    ai_adjustment_cap: float


class FeedWeightsUpdate(BaseModel):
    follow: float | None = Field(default=None, ge=0.0, le=2.0)
    recency: float | None = Field(default=None, ge=0.0, le=2.0)
    engagement: float | None = Field(default=None, ge=0.0, le=2.0)
    interest: float | None = Field(default=None, ge=0.0, le=2.0)
    pin: float | None = Field(default=None, ge=0.0, le=2.0)
    quality_penalty: float | None = Field(default=None, ge=0.0, le=2.0)
    ai_adjustment_cap: float | None = Field(default=None, ge=0.0, le=1.0)


class FeedConfigOut(BaseModel):
    id: str
    version: int
    weights: FeedWeightsOut
    ai_enabled: bool
    ai_timeout_ms: int
    ai_daily_budget_usd: float
    ai_spend_today_usd: float
    ai_last_reset: date
    updated_by: str | None
    updated_at: datetime


class FeedConfigUpdate(BaseModel):
    weights: FeedWeightsUpdate | None = None
    ai_enabled: bool | None = None
    ai_timeout_ms: int | None = Field(default=None, ge=100, le=5000)
    ai_daily_budget_usd: float | None = Field(default=None, ge=0.0, le=5000.0)
    reason: str | None = Field(default=None, max_length=300)


class FeedThreadOverrideUpdate(BaseModel):
    feed_boost: float | None = Field(default=None, ge=-1.0, le=1.0)
    feed_suppressed: bool | None = None
    reason: str | None = Field(default=None, max_length=300)


class FeedThreadOverrideResponse(BaseModel):
    thread_id: str
    feed_boost: float
    feed_suppressed: bool
    updated_at: datetime


class FeedRebuildResponse(BaseModel):
    success: bool
    processed: int
    message: str


class FeedDebugItem(BaseModel):
    thread_id: str
    title: str
    author_id: str
    score: float
    reasons: list[str] = Field(default_factory=list)
    breakdown: dict[str, float] = Field(default_factory=dict)
    created_at: datetime


class FeedDebugResponse(BaseModel):
    mode: Literal["home", "following"]
    user_id: str
    data: list[FeedDebugItem]
    next_cursor: str | None = None


class FeedAIHealthResponse(BaseModel):
    ai_enabled: bool
    ai_timeout_ms: int
    ai_daily_budget_usd: float
    ai_spend_today_usd: float
    ai_last_reset: date
    requests_count: int
    timeout_count: int
    error_count: int
    fallback_count: int


class FeedAIPolicyUpdate(BaseModel):
    ai_enabled: bool | None = None
    ai_timeout_ms: int | None = Field(default=None, ge=100, le=5000)
    ai_daily_budget_usd: float | None = Field(default=None, ge=0.0, le=5000.0)
    ai_adjustment_cap: float | None = Field(default=None, ge=0.0, le=1.0)
    reason: str | None = Field(default=None, max_length=300)


FeedInterestSuggestionReplaceMode = Literal["merge", "replace"]
FeedInterestSuggestionJobStatus = Literal["queued", "running", "completed", "completed_with_errors", "failed"]
FeedInterestSuggestionUserStatus = Literal["success", "fallback", "failed", "budget_exceeded"]


class FeedInterestSuggestionJobRequest(BaseModel):
    user_ids: list[str] = Field(min_length=1, max_length=50)
    replace_mode: FeedInterestSuggestionReplaceMode = "merge"
    max_tags_per_user: int = Field(default=8, ge=1, le=15)


class FeedInterestSuggestionUserResultOut(BaseModel):
    user_id: str
    status: FeedInterestSuggestionUserStatus
    suggested_tags: list[str] = Field(default_factory=list)
    applied_tags: list[str] = Field(default_factory=list)
    error: str | None = None


class FeedInterestSuggestionJobSummaryOut(BaseModel):
    job_id: str
    status: FeedInterestSuggestionJobStatus
    requested_count: int
    processed_count: int
    success_count: int
    failed_count: int
    replace_mode: FeedInterestSuggestionReplaceMode
    max_tags_per_user: int
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None


class FeedInterestSuggestionJobCreateOut(BaseModel):
    job_id: str
    status: FeedInterestSuggestionJobStatus
    requested_count: int
    created_at: datetime


class FeedInterestSuggestionJobOut(FeedInterestSuggestionJobSummaryOut):
    results: list[FeedInterestSuggestionUserResultOut] = Field(default_factory=list)


class FeedInterestSuggestionJobListOut(BaseModel):
    data: list[FeedInterestSuggestionJobSummaryOut]
