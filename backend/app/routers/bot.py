"""
Bot admin router — governance endpoints only.

Admin governs bot accounts (create, enable/disable, edit identity, trigger, view).
Scheduler config (intervals, topic seeds, daily limits) is owned by the bot service.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import require_roles
from app.models.audit_log import AuditLog, AuditResult, AuditSeverity
from app.models.bot import BotConfig
from app.models.post import Post
from app.models.thread import Thread
from app.models.user import User, UserRole
from app.schemas.bot import (
    BotActivityEntry,
    BotConfigResponse,
    BotContentItem,
    BotContentResponse,
    BotEnableRequest,
    BotListResponse,
    CreateBotRequest,
    UpdateBotIdentityRequest,
    UpdateBotScheduleRequest,
)
from app.services.audit import log_audit
from app.services.security import create_access_token

router = APIRouter(prefix="/admin/bot", tags=["admin-bot"])

_require_admin = require_roles(UserRole.ADMIN)


def _create_long_lived_token(user_id: str) -> str:
    """365-day JWT for internal scheduler use — never returned in API responses."""
    import jwt
    from datetime import timezone
    from app.core.config import get_settings

    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=365)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


async def _enrich(config: BotConfig) -> BotConfigResponse:
    """Attach username and avatar_url from the linked User document."""
    try:
        user = await User.find_one({"_id": PydanticObjectId(config.bot_user_id)})
    except Exception:
        user = None
    username = user.username if user else ""
    avatar_url = user.avatar_url if user else None
    return BotConfigResponse.from_config(config, username=username, avatar_url=avatar_url)


# ---------------------------------------------------------------------------
# GET /admin/bot
# ---------------------------------------------------------------------------


@router.get("", response_model=BotListResponse)
async def list_bots(admin: User = Depends(_require_admin)) -> BotListResponse:
    configs = await BotConfig.find_all().to_list()
    data = [await _enrich(c) for c in configs]
    return BotListResponse(data=data, total=len(data))


# ---------------------------------------------------------------------------
# POST /admin/bot/create
# ---------------------------------------------------------------------------


@router.post("/create", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_bot_account(body: CreateBotRequest, admin: User = Depends(_require_admin)) -> dict:
    # 1. Username uniqueness check
    existing = await User.find_one({"username": body.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    email_exists = await User.find_one({"email": body.email})
    if email_exists:
        raise HTTPException(status_code=400, detail="Email already registered")

    # 2. Create bot User (no password — bot never logs in via web)
    bot_user = User(
        username=body.username,
        display_name=body.display_name,
        email=body.email,
        bio=body.bio or None,
        avatar_url=body.avatar_url or None,
        is_bot=True,
        role=UserRole.MEMBER,
        is_active=True,
        password_hash=None,
    )
    await bot_user.insert()

    # 3. Generate long-lived JWT for scheduler use
    bot_token = _create_long_lived_token(str(bot_user.id))

    # 4. Create BotConfig linked to user
    config = BotConfig(
        bot_user_id=str(bot_user.id),
        display_name=body.display_name,
        persona=body.persona,
        enabled=body.enabled,
        topic_seeds=body.topic_seeds,
        channels=body.channels,
        thread_interval_hours=body.thread_interval_hours,
        comment_interval_hours=body.comment_interval_hours,
        engage_interval_hours=body.engage_interval_hours,
        max_threads_per_day=body.max_threads_per_day,
        max_comments_per_day=body.max_comments_per_day,
        min_thread_replies=body.min_thread_replies,
        bot_token=bot_token,
    )
    await config.insert()

    # 5. Reschedule if newly enabled
    if body.enabled:
        from app.services.bot_scheduler import reschedule_bot_jobs
        await reschedule_bot_jobs()

    await log_audit(
        action="bot_created",
        target_type="bot_config",
        actor_id=str(admin.id),
        target_id=str(config.id),
        severity=AuditSeverity.INFO,
        result=AuditResult.SUCCESS,
        details={"username": body.username, "display_name": body.display_name},
    )
    return {"bot_user_id": str(bot_user.id), "config_id": str(config.id)}


# ---------------------------------------------------------------------------
# PATCH /admin/bot/{config_id}/enable
# ---------------------------------------------------------------------------


@router.patch("/{config_id}/enable", response_model=BotConfigResponse)
async def set_bot_enabled(
    config_id: str,
    body: BotEnableRequest,
    admin: User = Depends(_require_admin),
) -> BotConfigResponse:
    config = await _get_config(config_id)
    config.enabled = body.enabled
    await config.save()

    from app.services.bot_scheduler import reschedule_bot_jobs
    await reschedule_bot_jobs()

    await log_audit(
        action="bot_enabled" if body.enabled else "bot_disabled",
        target_type="bot_config",
        actor_id=str(admin.id),
        target_id=config_id,
        severity=AuditSeverity.INFO,
        result=AuditResult.SUCCESS,
        details={"display_name": config.display_name},
    )
    return await _enrich(config)


# ---------------------------------------------------------------------------
# PUT /admin/bot/{config_id}/identity
# ---------------------------------------------------------------------------


@router.put("/{config_id}/identity", response_model=BotConfigResponse)
async def update_bot_identity(
    config_id: str,
    body: UpdateBotIdentityRequest,
    admin: User = Depends(_require_admin),
) -> BotConfigResponse:
    config = await _get_config(config_id)

    try:
        user = await User.find_one({"_id": PydanticObjectId(config.bot_user_id)})
    except Exception:
        user = None

    if body.display_name is not None:
        config.display_name = body.display_name
        if user:
            user.display_name = body.display_name
    if body.persona is not None:
        config.persona = body.persona
    if body.bio is not None and user:
        user.bio = body.bio
    if body.avatar_url is not None and user:
        user.avatar_url = body.avatar_url

    await config.save()
    if user:
        await user.save()

    await log_audit(
        action="bot_identity_updated",
        target_type="bot_config",
        actor_id=str(admin.id),
        target_id=config_id,
        severity=AuditSeverity.INFO,
        result=AuditResult.SUCCESS,
        details={"display_name": config.display_name},
    )
    return await _enrich(config)


# ---------------------------------------------------------------------------
# DELETE /admin/bot/{config_id}
# ---------------------------------------------------------------------------


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bot_config(config_id: str, admin: User = Depends(_require_admin)) -> None:
    config = await _get_config(config_id)
    display_name = config.display_name
    await config.delete()

    from app.services.bot_scheduler import reschedule_bot_jobs
    await reschedule_bot_jobs()

    await log_audit(
        action="bot_deleted",
        target_type="bot_config",
        actor_id=str(admin.id),
        target_id=config_id,
        severity=AuditSeverity.WARNING,
        result=AuditResult.SUCCESS,
        details={"display_name": display_name},
    )


# ---------------------------------------------------------------------------
# POST /admin/bot/{config_id}/trigger/*  — test triggers
# ---------------------------------------------------------------------------


@router.post("/{config_id}/trigger/thread", response_model=dict)
async def trigger_thread(config_id: str, admin: User = Depends(_require_admin)) -> dict:
    config = await _get_config(config_id)
    from app.services.bot_scheduler import _create_thread_for_config
    await _create_thread_for_config(config)
    return {"ok": True, "message": "Thread job triggered"}


@router.post("/{config_id}/trigger/comment", response_model=dict)
async def trigger_comment(config_id: str, admin: User = Depends(_require_admin)) -> dict:
    config = await _get_config(config_id)
    from app.services.bot_scheduler import _comment_for_config
    await _comment_for_config(config)
    return {"ok": True, "message": "Comment job triggered"}


@router.post("/{config_id}/trigger/engage", response_model=dict)
async def trigger_engage(config_id: str, admin: User = Depends(_require_admin)) -> dict:
    config = await _get_config(config_id)
    from app.services.bot_scheduler import _engage_for_config
    await _engage_for_config(config)
    return {"ok": True, "message": "Engage job triggered"}


# ---------------------------------------------------------------------------
# GET /admin/bot/{config_id}/activity
# ---------------------------------------------------------------------------


@router.get("/{config_id}/activity", response_model=list[BotActivityEntry])
async def get_bot_activity(config_id: str, admin: User = Depends(_require_admin)) -> list[BotActivityEntry]:
    config = await _get_config(config_id)

    logs = (
        await AuditLog.find(
            {
                "actor_id": PydanticObjectId(config.bot_user_id),
                "action": {"$in": ["bot_create_thread", "bot_comment", "bot_engage", "bot_error", "bot_created", "bot_enabled", "bot_disabled"]},
            }
        )
        .sort(-AuditLog.created_at)
        .limit(10)
        .to_list()
    )

    return [
        BotActivityEntry(
            id=str(log.id),
            action=log.action,
            created_at=log.created_at,
            details=log.details,
        )
        for log in logs
    ]


# ---------------------------------------------------------------------------
# PATCH /admin/bot/{config_id}/schedule  — update scheduler params
# ---------------------------------------------------------------------------


@router.patch("/{config_id}/schedule", response_model=BotConfigResponse)
async def update_bot_schedule(
    config_id: str,
    body: UpdateBotScheduleRequest,
    admin: User = Depends(_require_admin),
) -> BotConfigResponse:
    config = await _get_config(config_id)

    if body.topic_seeds is not None:
        config.topic_seeds = body.topic_seeds
    if body.channels is not None:
        config.channels = body.channels
    if body.thread_interval_hours is not None:
        config.thread_interval_hours = body.thread_interval_hours
    if body.comment_interval_hours is not None:
        config.comment_interval_hours = body.comment_interval_hours
    if body.engage_interval_hours is not None:
        config.engage_interval_hours = body.engage_interval_hours
    if body.max_threads_per_day is not None:
        config.max_threads_per_day = body.max_threads_per_day
    if body.max_comments_per_day is not None:
        config.max_comments_per_day = body.max_comments_per_day
    if body.min_thread_replies is not None:
        config.min_thread_replies = body.min_thread_replies

    await config.save()

    # Re-apply scheduler intervals live if enabled
    if config.enabled:
        from app.services.bot_scheduler import reschedule_bot_jobs
        await reschedule_bot_jobs()

    await log_audit(
        action="bot_schedule_updated",
        target_type="bot_config",
        actor_id=str(admin.id),
        target_id=config_id,
        severity=AuditSeverity.INFO,
        result=AuditResult.SUCCESS,
        details={
            "thread_interval_hours": config.thread_interval_hours,
            "comment_interval_hours": config.comment_interval_hours,
            "max_threads_per_day": config.max_threads_per_day,
            "topic_seeds_count": len(config.topic_seeds),
        },
    )
    return await _enrich(config)


# ---------------------------------------------------------------------------
# GET /admin/bot/{config_id}/content  — bot-authored threads + posts
# ---------------------------------------------------------------------------


@router.get("/{config_id}/content", response_model=BotContentResponse)
async def get_bot_content(
    config_id: str,
    limit: int = 40,
    admin: User = Depends(_require_admin),
) -> BotContentResponse:
    config = await _get_config(config_id)
    try:
        bot_oid = PydanticObjectId(config.bot_user_id)
    except Exception:
        return BotContentResponse(data=[], total=0)

    threads = (
        await Thread.find({"author_id": bot_oid})
        .sort(-Thread.created_at)
        .limit(limit)
        .to_list()
    )

    posts = (
        await Post.find({"author_id": bot_oid, "is_deleted": False})
        .sort(-Post.created_at)
        .limit(limit)
        .to_list()
    )

    # Batch-load parent thread titles for posts
    parent_thread_ids = list({p.thread_id for p in posts if p.thread_id})
    parent_threads: dict[str, Thread] = {}
    if parent_thread_ids:
        pt_list = await Thread.find({"_id": {"$in": parent_thread_ids}}).to_list()
        parent_threads = {str(t.id): t for t in pt_list}

    items: list[BotContentItem] = []

    for t in threads:
        items.append(BotContentItem(
            id=str(t.id),
            kind="thread",
            title=t.title,
            body=t.body[:300],
            thread_id=None,
            thread_title=None,
            tags=t.tags,
            is_flagged=t.is_flagged if hasattr(t, "is_flagged") else False,
            is_deleted=t.is_deleted if hasattr(t, "is_deleted") else False,
            ai_score=t.ai_score if hasattr(t, "ai_score") else None,
            post_count=t.post_count,
            created_at=t.created_at,
        ))

    for p in posts:
        parent = parent_threads.get(str(p.thread_id)) if p.thread_id else None
        items.append(BotContentItem(
            id=str(p.id),
            kind="post",
            title=None,
            body=p.content[:300],
            thread_id=str(p.thread_id) if p.thread_id else None,
            thread_title=parent.title if parent else None,
            tags=[],
            is_flagged=p.is_flagged,
            is_deleted=p.is_deleted,
            ai_score=p.ai_score,
            post_count=None,
            created_at=p.created_at,
        ))

    # Sort combined by created_at desc
    items.sort(key=lambda x: x.created_at, reverse=True)
    items = items[:limit]

    return BotContentResponse(data=items, total=len(items))


# ---------------------------------------------------------------------------
# PATCH /admin/bot/content/thread/{thread_id}  — edit bot thread
# ---------------------------------------------------------------------------


@router.patch("/content/thread/{thread_id}", response_model=dict)
async def edit_bot_thread(
    thread_id: str,
    body: dict,
    admin: User = Depends(_require_admin),
) -> dict:
    try:
        oid = PydanticObjectId(thread_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread = await Thread.get(oid)
    if not thread or thread.is_deleted:
        raise HTTPException(status_code=404, detail="Thread not found")

    title = body.get("title", "").strip()
    content = body.get("body", "").strip()
    if title:
        thread.title = title
    if content:
        thread.body = content
    await thread.save()

    await log_audit(
        action="bot_content_edited",
        target_type="thread",
        actor_id=str(admin.id),
        target_id=thread_id,
        severity=AuditSeverity.INFO,
        result=AuditResult.SUCCESS,
        details={"title": thread.title},
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# DELETE /admin/bot/content/thread/{thread_id}  — delete bot thread
# ---------------------------------------------------------------------------


@router.delete("/content/thread/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bot_thread(thread_id: str, admin: User = Depends(_require_admin)) -> None:
    try:
        oid = PydanticObjectId(thread_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread = await Thread.get(oid)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    thread.is_deleted = True
    await thread.save()

    await log_audit(
        action="bot_content_deleted",
        target_type="thread",
        actor_id=str(admin.id),
        target_id=thread_id,
        severity=AuditSeverity.WARNING,
        result=AuditResult.SUCCESS,
        details={"title": thread.title},
    )


# ---------------------------------------------------------------------------
# PATCH /admin/bot/content/thread/{thread_id}/archive  — archive bot thread
# ---------------------------------------------------------------------------


@router.patch("/content/thread/{thread_id}/archive", response_model=dict)
async def archive_bot_thread(thread_id: str, admin: User = Depends(_require_admin)) -> dict:
    try:
        oid = PydanticObjectId(thread_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread = await Thread.get(oid)
    if not thread or thread.is_deleted:
        raise HTTPException(status_code=404, detail="Thread not found")

    from app.models.thread import ThreadStatus
    thread.status = ThreadStatus.ARCHIVED
    await thread.save()

    await log_audit(
        action="bot_content_archived",
        target_type="thread",
        actor_id=str(admin.id),
        target_id=thread_id,
        severity=AuditSeverity.INFO,
        result=AuditResult.SUCCESS,
        details={"title": thread.title},
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# PATCH /admin/bot/content/post/{post_id}  — edit bot post
# ---------------------------------------------------------------------------


@router.patch("/content/post/{post_id}", response_model=dict)
async def edit_bot_post(
    post_id: str,
    body: dict,
    admin: User = Depends(_require_admin),
) -> dict:
    try:
        oid = PydanticObjectId(post_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Post not found")
    post = await Post.get(oid)
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found")

    content = body.get("content", "").strip()
    if content:
        post.content = content
        await post.save()

    await log_audit(
        action="bot_content_edited",
        target_type="post",
        actor_id=str(admin.id),
        target_id=post_id,
        severity=AuditSeverity.INFO,
        result=AuditResult.SUCCESS,
        details={"post_id": post_id},
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# DELETE /admin/bot/content/post/{post_id}  — delete bot post
# ---------------------------------------------------------------------------


@router.delete("/content/post/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bot_post(post_id: str, admin: User = Depends(_require_admin)) -> None:
    try:
        oid = PydanticObjectId(post_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Post not found")
    post = await Post.get(oid)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.is_deleted = True
    await post.save()

    await log_audit(
        action="bot_content_deleted",
        target_type="post",
        actor_id=str(admin.id),
        target_id=post_id,
        severity=AuditSeverity.WARNING,
        result=AuditResult.SUCCESS,
        details={"post_id": post_id},
    )


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------


async def _get_config(config_id: str) -> BotConfig:
    try:
        oid = PydanticObjectId(config_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Bot config not found")
    config = await BotConfig.get(oid)
    if not config:
        raise HTTPException(status_code=404, detail="Bot config not found")
    return config
