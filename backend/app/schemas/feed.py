from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.thread import ThreadStatus

FeedMode = Literal["home", "following"]


class FeedItemOut(BaseModel):
    id: str
    title: str
    body: str
    tags: list[str]
    author_id: str
    author_username: str | None = None
    author_display_name: str | None = None
    post_count: int
    status: ThreadStatus
    is_pinned: bool
    is_flagged: bool = False
    is_deleted: bool = False
    feed_boost: float = 0.0
    created_at: datetime
    updated_at: datetime
    score: float | None = None
    reasons: list[str] = Field(default_factory=list)


class FeedListResponse(BaseModel):
    data: list[FeedItemOut]
    limit: int
    next_cursor: str | None = None
    mode: FeedMode


class FeedPreferencesOut(BaseModel):
    interest_tags: list[str] = Field(default_factory=list)
    hidden_tags: list[str] = Field(default_factory=list)
    muted_user_ids: list[str] = Field(default_factory=list)
    topics_selected: bool = False


class PopularTopicOut(BaseModel):
    name: str
    thread_count: int


class PopularTopicsResponse(BaseModel):
    topics: list[PopularTopicOut]


class TopicsSetRequest(BaseModel):
    topics: list[str] = Field(min_length=1, max_length=30)


class MyFeedResponse(BaseModel):
    data: list[FeedItemOut]
    next_cursor: str | None = None
    has_topics: bool


class FeedPreferencesUpdate(BaseModel):
    interest_tags: list[str] | None = None
    hidden_tags: list[str] | None = None
    muted_user_ids: list[str] | None = None


class FeedInterestUpdate(BaseModel):
    interest_tags: list[str] = Field(default_factory=list)


class FeedExplainResponse(BaseModel):
    thread_id: str
    mode: FeedMode
    score: float
    reasons: list[str] = Field(default_factory=list)
    breakdown: dict[str, float] = Field(default_factory=dict)
