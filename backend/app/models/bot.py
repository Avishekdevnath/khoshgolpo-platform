from datetime import datetime

from beanie import Document
from pydantic import Field

from app.models.common import utc_now


class BotConfig(Document):
    """Operational config for one bot account. bot_token is never returned in API responses."""

    bot_user_id: str  # str representation of the User._id
    display_name: str = ""
    persona: str = ""
    enabled: bool = False

    # Scheduler config (owned by bot service, not admin panel)
    topic_seeds: list[str] = Field(default_factory=list)
    channels: list[str] = Field(default_factory=list)
    thread_interval_hours: float = 6.0
    comment_interval_hours: float = 2.0
    engage_interval_hours: float = 3.0
    max_threads_per_day: int = 2
    max_comments_per_day: int = 10
    min_thread_replies: int = 0

    # Runtime counters (reset daily)
    threads_created_today: int = 0
    comments_posted_today: int = 0
    daily_reset_at: datetime = Field(default_factory=utc_now)
    topics_used_today: list[str] = Field(default_factory=list)  # per-day topic dedup

    # Deduplication — persistent set of thread IDs the bot has commented on
    commented_thread_ids: list[str] = Field(default_factory=list)
    topic_index: int = 0  # ordered rotation pointer

    # Timestamps
    last_thread_at: datetime | None = None
    last_comment_at: datetime | None = None
    last_engage_at: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)

    # Long-lived JWT — NEVER exposed in API responses
    bot_token: str = ""

    class Settings:
        name = "bot_configs"
        indexes = ["bot_user_id", "enabled"]
