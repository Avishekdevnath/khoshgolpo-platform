from __future__ import annotations

from collections import Counter
from typing import Literal

from beanie import PydanticObjectId

from app.core.config import get_settings
from app.models.common import utc_now
from app.models.feed_interest_job import (
    FeedInterestSuggestionJob,
    FeedInterestSuggestionResult,
    JobStatus,
    UserResultStatus,
)
from app.models.post import Post
from app.models.thread import Thread
from app.models.user import User
from app.services.audit import log_audit
from app.services.feed_ai import (
    FeedAISuggestionError,
    FeedAISuggestionPayloadError,
    FeedAISuggestionTimeoutError,
    suggest_interest_tags,
)
from app.services.feed_config import get_or_create_feed_config

ReplaceMode = Literal["merge", "replace"]

_AI_UNIT_COST_USD = 0.01
_MAX_STORED_USER_TAGS = 30
_MAX_SIGNAL_TAGS = 30


def _normalize_tag_list(values: list[str], *, max_items: int) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        tag = raw.strip().lower()
        if not tag or tag in seen:
            continue
        seen.add(tag)
        normalized.append(tag)
        if len(normalized) >= max_items:
            break
    return normalized


def _apply_replace_mode(existing: list[str], suggested: list[str], mode: ReplaceMode) -> list[str]:
    normalized_existing = _normalize_tag_list(existing, max_items=_MAX_STORED_USER_TAGS)
    normalized_suggested = _normalize_tag_list(suggested, max_items=_MAX_STORED_USER_TAGS)
    if mode == "replace":
        return normalized_suggested[:_MAX_STORED_USER_TAGS]
    return _normalize_tag_list(
        [*normalized_existing, *normalized_suggested],
        max_items=_MAX_STORED_USER_TAGS,
    )


def _increment_weighted_tags(counter: Counter[str], tags: list[str], *, weight: int) -> None:
    for tag in _normalize_tag_list(tags, max_items=12):
        counter[tag] += weight


async def _collect_signal_tags(user: User) -> list[str]:
    tag_weights: Counter[str] = Counter()

    authored = (
        await Thread.find({"author_id": user.id, "is_deleted": False})
        .sort("-created_at")
        .limit(20)
        .to_list()
    )
    for thread in authored:
        _increment_weighted_tags(tag_weights, thread.tags, weight=3)

    recent_posts = (
        await Post.find({"author_id": user.id, "is_deleted": False})
        .sort("-created_at")
        .limit(40)
        .to_list()
    )
    post_thread_ids = list({post.thread_id for post in recent_posts})
    if post_thread_ids:
        commented_threads = await Thread.find({"_id": {"$in": post_thread_ids}, "is_deleted": False}).to_list()
        for thread in commented_threads:
            _increment_weighted_tags(tag_weights, thread.tags, weight=2)

    if user.following:
        followed_threads = (
            await Thread.find({"author_id": {"$in": user.following}, "is_deleted": False})
            .sort("-created_at")
            .limit(60)
            .to_list()
        )
        for thread in followed_threads:
            _increment_weighted_tags(tag_weights, thread.tags, weight=1)

    sorted_tags = sorted(tag_weights.items(), key=lambda item: (-item[1], item[0]))
    return [tag for tag, _count in sorted_tags[:_MAX_SIGNAL_TAGS]]


def _build_user_context(user: User) -> dict[str, object]:
    return {
        "interest_tags": user.interest_tags[:15],
        "hidden_tags": user.hidden_tags[:15],
        "following_count": len(user.following),
        "muted_count": len(user.muted_users),
    }


async def _suggest_tags_for_user(
    user: User,
    *,
    signal_tags: list[str],
    max_tags_per_user: int,
) -> tuple[list[str], UserResultStatus | Literal["failed"], str | None]:
    deterministic_fallback = signal_tags[:max_tags_per_user]
    feed_config = await get_or_create_feed_config()

    ai_globally_enabled = feed_config.ai_enabled
    budget_exhausted = feed_config.ai_spend_today_usd >= feed_config.ai_daily_budget_usd
    if not ai_globally_enabled:
        if deterministic_fallback:
            return deterministic_fallback, "fallback", "ai_disabled"
        return [], "failed", "ai_disabled_no_fallback"
    if budget_exhausted:
        if deterministic_fallback:
            return deterministic_fallback, "budget_exceeded", "budget_exceeded"
        return [], "failed", "budget_exceeded_no_fallback"
    if not get_settings().openai_api_key:
        if deterministic_fallback:
            return deterministic_fallback, "fallback", "ai_key_missing"
        return [], "failed", "ai_key_missing_no_fallback"

    feed_config.ai_requests_count += 1
    try:
        suggested = await suggest_interest_tags(
            _build_user_context(user),
            signal_tags,
            timeout_ms=feed_config.ai_timeout_ms,
            max_tags=max_tags_per_user,
        )
    except FeedAISuggestionTimeoutError:
        feed_config.ai_timeout_count += 1
        feed_config.ai_fallback_count += 1
        await feed_config.save()
        if deterministic_fallback:
            return deterministic_fallback, "fallback", "ai_timeout"
        return [], "failed", "ai_timeout_no_fallback"
    except (FeedAISuggestionPayloadError, FeedAISuggestionError):
        feed_config.ai_error_count += 1
        feed_config.ai_fallback_count += 1
        await feed_config.save()
        if deterministic_fallback:
            return deterministic_fallback, "fallback", "ai_error"
        return [], "failed", "ai_error_no_fallback"
    except Exception:
        feed_config.ai_error_count += 1
        feed_config.ai_fallback_count += 1
        await feed_config.save()
        if deterministic_fallback:
            return deterministic_fallback, "fallback", "ai_exception"
        return [], "failed", "ai_exception_no_fallback"

    feed_config.ai_spend_today_usd = round(
        min(feed_config.ai_daily_budget_usd, feed_config.ai_spend_today_usd + _AI_UNIT_COST_USD),
        6,
    )
    await feed_config.save()

    normalized = _normalize_tag_list(suggested, max_items=max_tags_per_user)
    if normalized:
        return normalized, "success", None
    if deterministic_fallback:
        feed_config.ai_fallback_count += 1
        await feed_config.save()
        return deterministic_fallback, "fallback", "ai_empty_payload"
    return [], "failed", "ai_empty_payload_no_fallback"


async def _mark_job_running(job: FeedInterestSuggestionJob) -> FeedInterestSuggestionJob:
    if job.status != "queued":
        return job
    job.status = "running"
    job.started_at = utc_now()
    await job.save()
    return job


def _coerce_job_status(success_count: int, failed_count: int) -> JobStatus:
    if failed_count == 0:
        return "completed"
    if success_count > 0:
        return "completed_with_errors"
    return "failed"


async def run_interest_suggestion_batch(job_id: str) -> None:
    try:
        object_id = PydanticObjectId(job_id)
    except Exception:
        return

    job = await FeedInterestSuggestionJob.find_one({"_id": object_id})
    if job is None:
        return

    try:
        if job.status not in {"queued", "running"}:
            return
        job = await _mark_job_running(job)
        if job.status != "running":
            return

        for user_id in job.requested_user_ids:
            user = await User.find_one({"_id": user_id, "is_active": True})
            if user is None:
                job.results.append(
                    FeedInterestSuggestionResult(
                        user_id=user_id,
                        status="failed",
                        suggested_tags=[],
                        applied_tags=[],
                        error="user_not_found_or_inactive",
                    )
                )
                job.processed_count += 1
                job.failed_count += 1
                continue

            signal_tags = await _collect_signal_tags(user)
            suggested_tags, result_status, result_error = await _suggest_tags_for_user(
                user,
                signal_tags=signal_tags,
                max_tags_per_user=job.max_tags_per_user,
            )

            if result_status == "failed":
                job.results.append(
                    FeedInterestSuggestionResult(
                        user_id=user.id,
                        status="failed",
                        suggested_tags=suggested_tags,
                        applied_tags=[],
                        error=result_error,
                    )
                )
                job.processed_count += 1
                job.failed_count += 1
                continue

            applied_tags = _apply_replace_mode(user.interest_tags, suggested_tags, job.replace_mode)
            user.interest_tags = applied_tags
            await user.save()

            job.results.append(
                FeedInterestSuggestionResult(
                    user_id=user.id,
                    status=result_status,
                    suggested_tags=suggested_tags,
                    applied_tags=applied_tags,
                    error=result_error,
                )
            )
            job.processed_count += 1
            job.success_count += 1

        job.status = _coerce_job_status(job.success_count, job.failed_count)
        job.finished_at = utc_now()
        await job.save()
        await log_audit(
            action="feed_interest_suggestion_batch_completed",
            actor_id=job.created_by,
            target_type="feed_interest_suggestion_job",
            target_id=job.id,
            details={
                "status": job.status,
                "requested_count": job.requested_count,
                "processed_count": job.processed_count,
                "success_count": job.success_count,
                "failed_count": job.failed_count,
            },
        )
    except Exception as exc:
        job.status = "failed"
        job.finished_at = utc_now()
        if not any(result.status == "failed" and (result.error or "").startswith("batch_runtime_error") for result in job.results):
            job.results.append(
                FeedInterestSuggestionResult(
                    user_id=job.created_by,
                    status="failed",
                    error=f"batch_runtime_error: {exc}",
                )
            )
        await job.save()
        await log_audit(
            action="feed_interest_suggestion_batch_completed",
            actor_id=job.created_by,
            target_type="feed_interest_suggestion_job",
            target_id=job.id,
            details={"status": "failed", "error": str(exc)},
        )
