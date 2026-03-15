from typing import Literal

from beanie import PydanticObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from app.core.auth import require_roles
from app.models.feed_interest_job import FeedInterestSuggestionJob, FeedInterestSuggestionResult
from app.models.thread import Thread
from app.models.user import User, UserRole
from app.schemas.feed_admin import (
    FeedAIHealthResponse,
    FeedAIPolicyUpdate,
    FeedConfigOut,
    FeedConfigUpdate,
    FeedDebugItem,
    FeedDebugResponse,
    FeedInterestSuggestionJobCreateOut,
    FeedInterestSuggestionJobListOut,
    FeedInterestSuggestionJobOut,
    FeedInterestSuggestionJobRequest,
    FeedInterestSuggestionJobStatus,
    FeedInterestSuggestionJobSummaryOut,
    FeedInterestSuggestionUserResultOut,
    FeedRebuildResponse,
    FeedThreadOverrideResponse,
    FeedThreadOverrideUpdate,
    FeedWeightsOut,
)
from app.services.audit import log_audit
from app.services.feed_config import get_or_create_feed_config
from app.services.feed_interest_suggester import run_interest_suggestion_batch
from app.services.feed_query import fetch_ranked_feed_slice

router = APIRouter(prefix="/admin/feed", tags=["admin-feed"])


@router.get("/config")
async def get_feed_config(_: User = Depends(require_roles(UserRole.ADMIN))) -> FeedConfigOut:
    config = await get_or_create_feed_config()
    return _to_feed_config_out(config)


@router.patch("/config")
async def update_feed_config(
    payload: FeedConfigUpdate,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> FeedConfigOut:
    config = await get_or_create_feed_config()
    changed_fields: list[str] = []

    if payload.weights is not None:
        for field_name in ("follow", "recency", "engagement", "interest", "pin", "quality_penalty", "ai_adjustment_cap"):
            new_value = getattr(payload.weights, field_name)
            if new_value is None:
                continue
            if getattr(config.weights, field_name) != new_value:
                setattr(config.weights, field_name, new_value)
                changed_fields.append(f"weights.{field_name}")

    if payload.ai_enabled is not None and payload.ai_enabled != config.ai_enabled:
        config.ai_enabled = payload.ai_enabled
        changed_fields.append("ai_enabled")
    if payload.ai_timeout_ms is not None and payload.ai_timeout_ms != config.ai_timeout_ms:
        config.ai_timeout_ms = payload.ai_timeout_ms
        changed_fields.append("ai_timeout_ms")
    if payload.ai_daily_budget_usd is not None and payload.ai_daily_budget_usd != config.ai_daily_budget_usd:
        config.ai_daily_budget_usd = payload.ai_daily_budget_usd
        changed_fields.append("ai_daily_budget_usd")

    if changed_fields:
        config.updated_by = admin_user.id
        await config.save()
        await log_audit(
            action="feed_config_updated",
            actor_id=admin_user.id,
            target_type="feed_config",
            target_id=config.id,
            details={"fields": changed_fields, "reason": payload.reason},
        )

    return _to_feed_config_out(config)


@router.patch("/threads/{thread_id}/override")
async def update_feed_thread_override(
    thread_id: str,
    payload: FeedThreadOverrideUpdate,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> FeedThreadOverrideResponse:
    object_id = _parse_object_id(thread_id, field_name="thread_id")
    thread = await Thread.find_one({"_id": object_id})
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    if payload.feed_boost is None and payload.feed_suppressed is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="At least one override field is required",
        )

    before = {"feed_boost": thread.feed_boost, "feed_suppressed": thread.feed_suppressed}
    if payload.feed_boost is not None:
        thread.feed_boost = payload.feed_boost
    if payload.feed_suppressed is not None:
        thread.feed_suppressed = payload.feed_suppressed
    await thread.save()

    await log_audit(
        action="feed_thread_override_updated",
        actor_id=admin_user.id,
        target_type="thread",
        target_id=thread.id,
        details={
            "reason": payload.reason,
            "before": before,
            "after": {"feed_boost": thread.feed_boost, "feed_suppressed": thread.feed_suppressed},
        },
    )

    return FeedThreadOverrideResponse(
        thread_id=str(thread.id),
        feed_boost=thread.feed_boost,
        feed_suppressed=thread.feed_suppressed,
        updated_at=thread.updated_at,
    )


@router.post("/rebuild")
async def rebuild_feed_index(admin_user: User = Depends(require_roles(UserRole.ADMIN))) -> FeedRebuildResponse:
    processed = await Thread.find({"is_deleted": False, "feed_suppressed": {"$ne": True}}).count()
    await log_audit(
        action="feed_rebuild_triggered",
        actor_id=admin_user.id,
        target_type="feed_config",
        target_id=None,
        details={"processed": processed},
    )
    return FeedRebuildResponse(
        success=True,
        processed=processed,
        message="Feed rebuild trigger accepted (no-op in MVP cacheless mode).",
    )


@router.get("/debug")
async def debug_feed(
    user_id: str = Query(...),
    mode: Literal["home", "following"] = Query(default="home"),
    limit: int = Query(default=20, ge=1, le=50),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> FeedDebugResponse:
    target_user = await _find_user_or_404(user_id)
    config = await get_or_create_feed_config()
    ranked, next_cursor = await fetch_ranked_feed_slice(
        target_user,
        mode=mode,
        limit=limit,
        cursor=None,
        weights=config.weights,
    )
    return FeedDebugResponse(
        mode=mode,
        user_id=str(target_user.id),
        data=[
            FeedDebugItem(
                thread_id=str(item.thread.id),
                title=item.thread.title,
                author_id=str(item.thread.author_id),
                score=item.score,
                reasons=item.reasons,
                breakdown=item.breakdown,
                created_at=item.thread.created_at,
            )
            for item in ranked
        ],
        next_cursor=next_cursor,
    )


@router.get("/ai/health")
async def get_feed_ai_health(_: User = Depends(require_roles(UserRole.ADMIN))) -> FeedAIHealthResponse:
    config = await get_or_create_feed_config()
    return FeedAIHealthResponse(
        ai_enabled=config.ai_enabled,
        ai_timeout_ms=config.ai_timeout_ms,
        ai_daily_budget_usd=config.ai_daily_budget_usd,
        ai_spend_today_usd=config.ai_spend_today_usd,
        ai_last_reset=config.ai_last_reset,
        requests_count=config.ai_requests_count,
        timeout_count=config.ai_timeout_count,
        error_count=config.ai_error_count,
        fallback_count=config.ai_fallback_count,
    )


@router.patch("/ai/policy")
async def update_feed_ai_policy(
    payload: FeedAIPolicyUpdate,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> FeedConfigOut:
    config = await get_or_create_feed_config()
    changed_fields: list[str] = []

    if payload.ai_enabled is not None and payload.ai_enabled != config.ai_enabled:
        config.ai_enabled = payload.ai_enabled
        changed_fields.append("ai_enabled")
    if payload.ai_timeout_ms is not None and payload.ai_timeout_ms != config.ai_timeout_ms:
        config.ai_timeout_ms = payload.ai_timeout_ms
        changed_fields.append("ai_timeout_ms")
    if payload.ai_daily_budget_usd is not None and payload.ai_daily_budget_usd != config.ai_daily_budget_usd:
        config.ai_daily_budget_usd = payload.ai_daily_budget_usd
        changed_fields.append("ai_daily_budget_usd")
    if payload.ai_adjustment_cap is not None and payload.ai_adjustment_cap != config.weights.ai_adjustment_cap:
        config.weights.ai_adjustment_cap = payload.ai_adjustment_cap
        changed_fields.append("weights.ai_adjustment_cap")

    if changed_fields:
        config.updated_by = admin_user.id
        await config.save()
        await log_audit(
            action="feed_ai_policy_updated",
            actor_id=admin_user.id,
            target_type="feed_config",
            target_id=config.id,
            details={"fields": changed_fields, "reason": payload.reason},
        )

    return _to_feed_config_out(config)


@router.post(
    "/interests/suggestions/jobs",
    status_code=status.HTTP_201_CREATED,
    response_model=FeedInterestSuggestionJobCreateOut,
)
async def create_feed_interest_suggestion_job(
    payload: FeedInterestSuggestionJobRequest,
    background_tasks: BackgroundTasks,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> FeedInterestSuggestionJobCreateOut:
    requested_user_ids: list[PydanticObjectId] = []
    seen: set[str] = set()
    for raw_user_id in payload.user_ids:
        object_id = _parse_object_id(raw_user_id, field_name="user_id")
        key = str(object_id)
        if key in seen:
            continue
        seen.add(key)
        requested_user_ids.append(object_id)

    if not requested_user_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="At least one valid user id is required",
        )

    job = FeedInterestSuggestionJob(
        status="queued",
        requested_user_ids=requested_user_ids,
        replace_mode=payload.replace_mode,
        max_tags_per_user=payload.max_tags_per_user,
        requested_count=len(requested_user_ids),
        created_by=admin_user.id,
    )
    await job.insert()

    await log_audit(
        action="feed_interest_suggestion_batch_triggered",
        actor_id=admin_user.id,
        target_type="feed_interest_suggestion_job",
        target_id=job.id,
        details={
            "requested_count": job.requested_count,
            "replace_mode": job.replace_mode,
            "max_tags_per_user": job.max_tags_per_user,
        },
    )

    background_tasks.add_task(run_interest_suggestion_batch, str(job.id))
    return FeedInterestSuggestionJobCreateOut(
        job_id=str(job.id),
        status=job.status,
        requested_count=job.requested_count,
        created_at=job.created_at,
    )


@router.get(
    "/interests/suggestions/jobs/{job_id}",
    response_model=FeedInterestSuggestionJobOut,
)
async def get_feed_interest_suggestion_job(
    job_id: str,
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> FeedInterestSuggestionJobOut:
    object_id = _parse_object_id(job_id, field_name="job_id")
    job = await FeedInterestSuggestionJob.find_one({"_id": object_id})
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion job not found")
    return _to_interest_job_out(job)


@router.get(
    "/interests/suggestions/jobs",
    response_model=FeedInterestSuggestionJobListOut,
)
async def list_feed_interest_suggestion_jobs(
    limit: int = Query(default=20, ge=1, le=50),
    status_filter: FeedInterestSuggestionJobStatus | None = Query(default=None, alias="status"),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> FeedInterestSuggestionJobListOut:
    query_filter: dict[str, object] = {}
    if status_filter is not None:
        query_filter["status"] = status_filter

    jobs = (
        await FeedInterestSuggestionJob.find(query_filter)
        .sort("-created_at")
        .limit(limit)
        .to_list()
    )
    return FeedInterestSuggestionJobListOut(data=[_to_interest_job_summary_out(job) for job in jobs])


def _parse_object_id(value: str, *, field_name: str) -> PydanticObjectId:
    try:
        return PydanticObjectId(value)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Invalid {field_name}",
        ) from exc


async def _find_user_or_404(user_id: str) -> User:
    user = None
    try:
        object_id = PydanticObjectId(user_id)
        user = await User.find_one({"_id": object_id})
    except Exception:
        user = await User.find_one({"username": user_id.strip().lower()})
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _to_interest_user_result_out(result: FeedInterestSuggestionResult) -> FeedInterestSuggestionUserResultOut:
    return FeedInterestSuggestionUserResultOut(
        user_id=str(result.user_id),
        status=result.status,
        suggested_tags=result.suggested_tags,
        applied_tags=result.applied_tags,
        error=result.error,
    )


def _to_interest_job_summary_out(job: FeedInterestSuggestionJob) -> FeedInterestSuggestionJobSummaryOut:
    return FeedInterestSuggestionJobSummaryOut(
        job_id=str(job.id),
        status=job.status,
        requested_count=job.requested_count,
        processed_count=job.processed_count,
        success_count=job.success_count,
        failed_count=job.failed_count,
        replace_mode=job.replace_mode,
        max_tags_per_user=job.max_tags_per_user,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
    )


def _to_interest_job_out(job: FeedInterestSuggestionJob) -> FeedInterestSuggestionJobOut:
    return FeedInterestSuggestionJobOut(
        **_to_interest_job_summary_out(job).model_dump(),
        results=[_to_interest_user_result_out(item) for item in job.results],
    )


def _to_feed_config_out(config) -> FeedConfigOut:
    return FeedConfigOut(
        id=str(config.id),
        version=config.version,
        weights=FeedWeightsOut(
            follow=config.weights.follow,
            recency=config.weights.recency,
            engagement=config.weights.engagement,
            interest=config.weights.interest,
            pin=config.weights.pin,
            quality_penalty=config.weights.quality_penalty,
            ai_adjustment_cap=config.weights.ai_adjustment_cap,
        ),
        ai_enabled=config.ai_enabled,
        ai_timeout_ms=config.ai_timeout_ms,
        ai_daily_budget_usd=config.ai_daily_budget_usd,
        ai_spend_today_usd=config.ai_spend_today_usd,
        ai_last_reset=config.ai_last_reset,
        updated_by=str(config.updated_by) if config.updated_by else None,
        updated_at=config.updated_at,
    )
