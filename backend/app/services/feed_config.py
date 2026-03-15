from app.models.common import utc_now
from app.models.feed_config import FeedConfig


async def get_or_create_feed_config() -> FeedConfig:
    config = await FeedConfig.find_one({})
    if config is None:
        config = FeedConfig()
        await config.insert()
        return config

    today = utc_now().date()
    if config.ai_last_reset != today:
        config.ai_last_reset = today
        config.ai_spend_today_usd = 0.0
        config.ai_requests_count = 0
        config.ai_timeout_count = 0
        config.ai_error_count = 0
        config.ai_fallback_count = 0
        await config.save()
    return config
