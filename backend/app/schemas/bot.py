from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.bot import BotConfig


class CreateBotRequest(BaseModel):
    # Identity — creates User record
    username: str
    display_name: str
    email: EmailStr
    bio: str = ""
    avatar_url: str = ""

    # Persona — injected into every GPT system prompt
    persona: str = ""

    # Scheduler config — stored in BotConfig
    topic_seeds: list[str] = []
    channels: list[str] = []
    thread_interval_hours: float = 6.0
    comment_interval_hours: float = 2.0
    engage_interval_hours: float = 3.0
    max_threads_per_day: int = 2
    max_comments_per_day: int = 10
    min_thread_replies: int = 1
    enabled: bool = False  # start disabled; admin enables after review


class UpdateBotIdentityRequest(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    persona: str | None = None


class BotEnableRequest(BaseModel):
    enabled: bool


class BotConfigResponse(BaseModel):
    """Safe response — bot_token is intentionally omitted."""

    id: str
    bot_user_id: str
    display_name: str
    persona: str
    enabled: bool
    topic_seeds: list[str]
    channels: list[str]
    thread_interval_hours: float
    comment_interval_hours: float
    engage_interval_hours: float
    max_threads_per_day: int
    max_comments_per_day: int
    min_thread_replies: int
    threads_created_today: int
    comments_posted_today: int
    last_thread_at: datetime | None
    last_comment_at: datetime | None
    last_engage_at: datetime | None
    created_at: datetime

    # Augmented at query time from User document
    username: str = ""
    avatar_url: str | None = None

    @classmethod
    def from_config(cls, config: BotConfig, username: str = "", avatar_url: str | None = None) -> "BotConfigResponse":
        return cls(
            id=str(config.id),
            bot_user_id=config.bot_user_id,
            display_name=config.display_name,
            persona=config.persona,
            enabled=config.enabled,
            topic_seeds=config.topic_seeds,
            channels=config.channels,
            thread_interval_hours=config.thread_interval_hours,
            comment_interval_hours=config.comment_interval_hours,
            engage_interval_hours=config.engage_interval_hours,
            max_threads_per_day=config.max_threads_per_day,
            max_comments_per_day=config.max_comments_per_day,
            min_thread_replies=config.min_thread_replies,
            threads_created_today=config.threads_created_today,
            comments_posted_today=config.comments_posted_today,
            last_thread_at=config.last_thread_at,
            last_comment_at=config.last_comment_at,
            last_engage_at=config.last_engage_at,
            created_at=config.created_at,
            username=username,
            avatar_url=avatar_url,
        )


class BotListResponse(BaseModel):
    data: list[BotConfigResponse]
    total: int


class BotActivityEntry(BaseModel):
    id: str
    action: str
    created_at: datetime
    details: dict


class UpdateBotScheduleRequest(BaseModel):
    topic_seeds: list[str] | None = None
    channels: list[str] | None = None
    thread_interval_hours: float | None = None
    comment_interval_hours: float | None = None
    engage_interval_hours: float | None = None
    max_threads_per_day: int | None = None
    max_comments_per_day: int | None = None
    min_thread_replies: int | None = None


class BotContentItem(BaseModel):
    id: str
    kind: str           # "thread" | "post"
    title: str | None   # only for threads
    body: str
    thread_id: str | None   # only for posts
    thread_title: str | None
    tags: list[str]
    is_flagged: bool
    is_deleted: bool
    ai_score: float | None
    post_count: int | None  # only for threads
    created_at: datetime


class BotContentResponse(BaseModel):
    data: list[BotContentItem]
    total: int
