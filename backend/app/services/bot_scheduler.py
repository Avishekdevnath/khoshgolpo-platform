"""
Bot Scheduler — standalone service.

Owns all scheduling logic, GPT calls, deduplication, daily limits, and the
engagement loop. Does NOT depend on the admin module in any way.

Auth note: bot only runs in AUTH_MODE=jwt. In static mode it exits silently.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import get_settings

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _today_date():
    return _utc_now().date()


async def _reset_daily_counters_if_needed(config) -> None:
    """Reset per-day counters when the calendar day rolls over."""
    from app.models.bot import BotConfig  # local import to avoid circular deps

    reset_date = config.daily_reset_at.date() if config.daily_reset_at else None
    if reset_date != _today_date():
        config.threads_created_today = 0
        config.comments_posted_today = 0
        config.topics_used_today = []
        config.daily_reset_at = _utc_now()
        await config.save()


async def _call_openai(system_prompt: str, user_prompt: str, max_tokens: int = 400) -> str:
    """Call OpenAI chat completions. Raises on failure."""
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY not configured")

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.chat.completions.create(
        model=settings.ai_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=max_tokens,
        temperature=0.85,
    )
    return response.choices[0].message.content or ""


# ---------------------------------------------------------------------------
# Job 1 — Create thread
# ---------------------------------------------------------------------------


async def _create_thread_for_config(config) -> None:
    from beanie import PydanticObjectId as ObjId
    from app.models.thread import Thread
    from app.models.user import User
    from app.services.audit import log_audit
    from app.models.audit_log import AuditSeverity, AuditResult

    await _reset_daily_counters_if_needed(config)
    if config.threads_created_today >= config.max_threads_per_day:
        logger.debug("Bot %s: daily thread limit reached, skipping", config.bot_user_id)
        return

    topic_seeds = config.topic_seeds
    if not topic_seeds:
        logger.debug("Bot %s: no topic seeds configured, skipping thread creation", config.bot_user_id)
        return

    # Find a topic not already used today, rotating through seeds
    topic = None
    seeds_count = len(topic_seeds)
    for _ in range(seeds_count):
        candidate_topic = topic_seeds[config.topic_index % seeds_count]
        config.topic_index = (config.topic_index + 1) % seeds_count
        if candidate_topic not in config.topics_used_today:
            topic = candidate_topic
            break

    if topic is None:
        logger.debug("Bot %s: all topic seeds already used today, skipping thread creation", config.bot_user_id)
        await config.save()
        return

    await config.save()

    try:
        system_prompt = (
            config.persona or "You are a thoughtful, knowledgeable community member who writes detailed, engaging forum posts."
        )
        user_prompt = (
            f"Write a full, well-structured discussion thread article for a community forum about: {topic}\n\n"
            "Requirements:\n"
            "- Length: 500-1000 words in the body\n"
            "- Title: specific and curiosity-sparking, under 120 chars\n"
            "- Structure: intro paragraph → 3-5 substantive paragraphs with concrete examples, data, or personal anecdotes → closing question\n"
            "- At least one real-world example, statistic, or scenario that adds depth\n"
            "- End with a genuinely open question that invites replies from the community\n"
            "- Tone: conversational but substantive — like a thoughtful forum post, NOT a blog article or listicle\n"
            "- Do NOT use headers like '## Introduction' — write flowing paragraphs\n\n"
            "Format EXACTLY as:\n"
            "TITLE: <title here>\n"
            "CONTENT:\n"
            "<full body here, paragraphs separated by blank lines>\n"
        )
        raw = await _call_openai(system_prompt, user_prompt, max_tokens=1500)

        title = ""
        body = ""
        lines = raw.splitlines()
        content_start = None
        for i, line in enumerate(lines):
            if line.startswith("TITLE:") and not title:
                title = line[6:].strip()
            elif line.strip() == "CONTENT:" or line.startswith("CONTENT:\n"):
                content_start = i + 1
                break
            elif line.startswith("CONTENT:") and not body:
                # Inline CONTENT: <text> fallback
                inline = line[8:].strip()
                if inline:
                    content_start = None
                    body = inline
                else:
                    content_start = i + 1
                break

        if content_start is not None:
            body = "\n".join(lines[content_start:]).strip()

        if not title or not body:
            raise ValueError(f"GPT output malformed: {raw!r}")

        bot_user = await User.find_one({"_id": ObjId(config.bot_user_id)})
        if not bot_user:
            return

        thread = Thread(
            title=title,
            body=body,
            author_id=bot_user.id,
            tags=[topic.lower()],
        )
        await thread.insert()

        config.threads_created_today += 1
        config.last_thread_at = _utc_now()
        if topic not in config.topics_used_today:
            config.topics_used_today = config.topics_used_today + [topic]
        await config.save()

        await log_audit(
            action="bot_create_thread",
            target_type="thread",
            actor_id=config.bot_user_id,
            target_id=str(thread.id),
            severity=AuditSeverity.INFO,
            result=AuditResult.SUCCESS,
            details={"title": title, "bot_display_name": config.display_name},
        )
        logger.info("Bot %s created thread: %s", config.display_name, title)

    except Exception as exc:
        await log_audit(
            action="bot_error",
            target_type="bot_config",
            actor_id=config.bot_user_id,
            severity=AuditSeverity.WARNING,
            result=AuditResult.FAILED,
            details={"error": str(exc), "job": "create_thread", "bot": config.display_name},
        )
        logger.warning("Bot %s thread creation failed: %s", config.display_name, exc)


async def job_create_threads() -> None:
    """Scheduler job: create threads for all enabled bots."""
    settings = get_settings()
    if settings.auth_mode != "jwt":
        return

    try:
        from app.models.bot import BotConfig

        configs = await BotConfig.find(BotConfig.enabled == True).to_list()
        for config in configs:
            try:
                await _create_thread_for_config(config)
            except Exception as exc:
                logger.error("Bot %s unhandled error in thread job: %s", config.bot_user_id, exc)
    except Exception as exc:
        logger.error("job_create_threads failed: %s", exc)


# ---------------------------------------------------------------------------
# Job 2 — Comment on existing threads
# ---------------------------------------------------------------------------


async def _comment_for_config(config) -> None:
    from beanie import PydanticObjectId as ObjId
    from app.models.post import Post
    from app.models.thread import Thread
    from app.models.user import User
    from app.services.audit import log_audit
    from app.models.audit_log import AuditSeverity, AuditResult

    await _reset_daily_counters_if_needed(config)
    if config.comments_posted_today >= config.max_comments_per_day:
        logger.debug("Bot %s: daily comment limit reached, skipping", config.bot_user_id)
        return

    bot_user = await User.find_one({"_id": ObjId(config.bot_user_id)})
    if not bot_user:
        return

    # Find threads the bot hasn't commented on yet, with enough replies to be worth joining
    already_commented = set(config.commented_thread_ids)

    threads = await Thread.find(
        {"is_deleted": False, "status": "open"}
    ).sort("-created_at").limit(50).to_list()

    candidate = None
    for t in threads:
        if str(t.id) in already_commented:
            continue
        if (t.post_count or 0) < config.min_thread_replies:
            continue
        candidate = t
        break

    if not candidate:
        logger.debug("Bot %s: no eligible threads to comment on", config.bot_user_id)
        return

    try:
        system_prompt = config.persona or "You are a thoughtful community member."
        user_prompt = (
            f"Thread title: {candidate.title}\n"
            f"Thread body: {candidate.body or ''}\n\n"
            "Write a short, natural comment (2-3 sentences) that adds to the discussion. "
            "Be conversational and genuine."
        )
        comment_text = await _call_openai(system_prompt, user_prompt)
        comment_text = comment_text.strip()

        if not comment_text:
            raise ValueError("GPT returned empty comment")

        post = Post(
            thread_id=candidate.id,
            author_id=bot_user.id,
            content=comment_text,
        )
        await post.insert()

        # Update dedup set
        config.commented_thread_ids = list(already_commented | {str(candidate.id)})
        config.comments_posted_today += 1
        config.last_comment_at = _utc_now()
        await config.save()

        await log_audit(
            action="bot_comment",
            target_type="post",
            actor_id=config.bot_user_id,
            target_id=str(post.id),
            severity=AuditSeverity.INFO,
            result=AuditResult.SUCCESS,
            details={"thread_id": str(candidate.id), "thread_title": candidate.title, "bot": config.display_name},
        )
        logger.info("Bot %s commented on thread: %s", config.display_name, candidate.title)

    except Exception as exc:
        await log_audit(
            action="bot_error",
            target_type="bot_config",
            actor_id=config.bot_user_id,
            severity=AuditSeverity.WARNING,
            result=AuditResult.FAILED,
            details={"error": str(exc), "job": "comment", "bot": config.display_name},
        )
        logger.warning("Bot %s comment failed: %s", config.display_name, exc)


async def job_post_comments() -> None:
    """Scheduler job: comment on threads for all enabled bots."""
    settings = get_settings()
    if settings.auth_mode != "jwt":
        return

    try:
        from app.models.bot import BotConfig

        configs = await BotConfig.find(BotConfig.enabled == True).to_list()
        for config in configs:
            try:
                await _comment_for_config(config)
            except Exception as exc:
                logger.error("Bot %s unhandled error in comment job: %s", config.bot_user_id, exc)
    except Exception as exc:
        logger.error("job_post_comments failed: %s", exc)


# ---------------------------------------------------------------------------
# Job 3 — Engagement loop (reply to own threads when users respond)
# ---------------------------------------------------------------------------


async def _engage_for_config(config) -> None:
    from beanie import PydanticObjectId as ObjId
    from app.models.post import Post
    from app.models.thread import Thread
    from app.models.user import User
    from app.services.audit import log_audit
    from app.models.audit_log import AuditSeverity, AuditResult

    await _reset_daily_counters_if_needed(config)
    if config.comments_posted_today >= config.max_comments_per_day:
        return

    bot_user = await User.find_one({"_id": ObjId(config.bot_user_id)})
    if not bot_user:
        return

    # Find bot's own threads that have posts from OTHER users
    bot_threads = await Thread.find(
        {"author_id": bot_user.id, "is_deleted": False}
    ).sort("-updated_at").limit(20).to_list()

    for thread in bot_threads:
        posts = await Post.find(
            {"thread_id": thread.id, "is_deleted": False}
        ).sort("-created_at").limit(10).to_list()

        # Check if the last post is NOT from the bot (so we have something to reply to)
        if not posts:
            continue
        latest = posts[0]
        if str(latest.author_id) == config.bot_user_id:
            continue

        # Build conversation context from recent posts (newest-first → reverse for chronological)
        context_lines = []
        for p in reversed(posts[-4:]):
            label = "You" if str(p.author_id) == config.bot_user_id else "User"
            context_lines.append(f"{label}: {p.content}")
        context = "\n".join(context_lines)

        try:
            system_prompt = config.persona or "You are a thoughtful community member."
            user_prompt = (
                f"You started a thread titled: {thread.title}\n\n"
                f"Recent conversation:\n{context}\n\n"
                "Write a short follow-up reply (2-3 sentences) that keeps the conversation going naturally."
            )
            reply_text = await _call_openai(system_prompt, user_prompt)
            reply_text = reply_text.strip()

            if not reply_text:
                continue

            reply = Post(
                thread_id=thread.id,
                author_id=bot_user.id,
                content=reply_text,
            )
            await reply.insert()

            config.comments_posted_today += 1
            config.last_engage_at = _utc_now()
            await config.save()

            await log_audit(
                action="bot_engage",
                target_type="post",
                actor_id=config.bot_user_id,
                target_id=str(reply.id),
                severity=AuditSeverity.INFO,
                result=AuditResult.SUCCESS,
                details={"thread_id": str(thread.id), "thread_title": thread.title, "bot": config.display_name},
            )
            logger.info("Bot %s engaged on own thread: %s", config.display_name, thread.title)

            if config.comments_posted_today >= config.max_comments_per_day:
                break

        except Exception as exc:
            await log_audit(
                action="bot_error",
                target_type="bot_config",
                actor_id=config.bot_user_id,
                severity=AuditSeverity.WARNING,
                result=AuditResult.FAILED,
                details={"error": str(exc), "job": "engage", "bot": config.display_name},
            )
            logger.warning("Bot %s engage failed on thread %s: %s", config.display_name, thread.id, exc)


async def job_engage() -> None:
    """Scheduler job: engagement loop for all enabled bots."""
    settings = get_settings()
    if settings.auth_mode != "jwt":
        return

    try:
        from app.models.bot import BotConfig

        configs = await BotConfig.find(BotConfig.enabled == True).to_list()
        for config in configs:
            try:
                await _engage_for_config(config)
            except Exception as exc:
                logger.error("Bot %s unhandled error in engage job: %s", config.bot_user_id, exc)
    except Exception as exc:
        logger.error("job_engage failed: %s", exc)


# ---------------------------------------------------------------------------
# Scheduler lifecycle
# ---------------------------------------------------------------------------


async def reschedule_bot_jobs() -> None:
    """Re-reads enabled BotConfigs and updates APScheduler job intervals live."""
    from app.models.bot import BotConfig

    configs = await BotConfig.find(BotConfig.enabled == True).to_list()
    if not configs:
        # No enabled bots — pause all jobs
        for job_id in ("bot_thread", "bot_comment", "bot_engage"):
            job = scheduler.get_job(job_id)
            if job:
                job.pause()
        return

    min_thread = min(c.thread_interval_hours for c in configs)
    min_comment = min(c.comment_interval_hours for c in configs)
    min_engage = min(c.engage_interval_hours for c in configs)

    for job_id, hours in [("bot_thread", min_thread), ("bot_comment", min_comment), ("bot_engage", min_engage)]:
        job = scheduler.get_job(job_id)
        if job:
            scheduler.reschedule_job(job_id, trigger="interval", seconds=max(1, round(hours * 3600)))
            job.resume()


def start_scheduler() -> None:
    """Called from FastAPI lifespan on startup. No-op in static auth mode."""
    settings = get_settings()
    if settings.auth_mode != "jwt":
        logger.info("Bot scheduler disabled (AUTH_MODE=static)")
        return

    scheduler.add_job(job_create_threads, "interval", seconds=6 * 3600, id="bot_thread", replace_existing=True)
    scheduler.add_job(job_post_comments, "interval", seconds=2 * 3600, id="bot_comment", replace_existing=True)
    scheduler.add_job(job_engage, "interval", seconds=3 * 3600, id="bot_engage", replace_existing=True)
    scheduler.start()
    logger.info("Bot scheduler started")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Bot scheduler stopped")
