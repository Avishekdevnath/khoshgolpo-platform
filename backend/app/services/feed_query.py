from __future__ import annotations

import base64
import json
from typing import Any, Awaitable, Callable

from app.core.config import Settings, get_settings
from app.models.feed_config import FeedConfig, FeedWeights
from app.models.thread import Thread
from app.models.user import User
from app.services.feed_ai import FeedAIRerankError, FeedAIRerankPayloadError, FeedAIRerankTimeoutError, rerank_shortlist
from app.services.feed_ranker import FeedScoredThread, rank_threads, score_thread

_AI_SHORTLIST_SIZE = 30
_AI_UNIT_COST_USD = 0.01


def encode_offset_cursor(offset: int) -> str:
    payload = json.dumps({"offset": max(offset, 0)}, separators=(",", ":")).encode("utf-8")
    encoded = base64.urlsafe_b64encode(payload).decode("utf-8")
    return encoded.rstrip("=")


def decode_offset_cursor(cursor: str | None) -> int:
    if not cursor:
        return 0
    padded = cursor + ("=" * (-len(cursor) % 4))
    try:
        raw = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
        data = json.loads(raw)
        offset = int(data.get("offset", 0))
        return max(offset, 0)
    except Exception as exc:  # pragma: no cover - defensive input guard
        raise ValueError("Invalid cursor") from exc


def _normalized_tag_set(tags: list[str]) -> set[str]:
    return {tag.strip().lower() for tag in tags if tag.strip()}


def apply_visibility_filters(threads: list[Thread], current_user: User) -> list[Thread]:
    muted_users = {str(item) for item in current_user.muted_users}
    hidden_tags = _normalized_tag_set(current_user.hidden_tags)

    visible: list[Thread] = []
    for thread in threads:
        if thread.is_deleted or thread.feed_suppressed:
            continue
        if muted_users and str(thread.author_id) in muted_users:
            continue
        if hidden_tags and hidden_tags.intersection(_normalized_tag_set(thread.tags)):
            continue
        visible.append(thread)
    return visible


def _stable_sort_key(item: FeedScoredThread) -> tuple[float, float, str]:
    return (-item.score, -item.thread.created_at.timestamp(), str(item.thread.id))


def _clamp(value: float, minimum: float, maximum: float) -> float:
    if value < minimum:
        return minimum
    if value > maximum:
        return maximum
    return value


def _build_ai_user_context(current_user: User) -> dict[str, Any]:
    return {
        "interest_tags": current_user.interest_tags[:15],
        "following_count": len(current_user.following),
        "muted_count": len(current_user.muted_users),
    }


async def _maybe_apply_ai_rerank(
    ranked: list[FeedScoredThread],
    *,
    current_user: User,
    mode: str,
    cursor: str | None,
    feed_config: FeedConfig | None,
    settings: Settings | None,
    rerank_func: Callable[[dict[str, Any], list[Thread], int, float], Awaitable[dict[str, float]]],
) -> list[FeedScoredThread]:
    if not ranked or feed_config is None:
        return ranked
    if mode != "home" or cursor is not None:
        return ranked

    active_settings = settings or get_settings()
    if not active_settings.feed_v2_enabled or not active_settings.feed_ai_enabled:
        return ranked
    if not feed_config.ai_enabled:
        return ranked
    if feed_config.ai_spend_today_usd >= feed_config.ai_daily_budget_usd:
        return ranked

    shortlist = ranked[:_AI_SHORTLIST_SIZE]
    shortlist_ids = {str(item.thread.id) for item in shortlist}
    if not shortlist_ids:
        return ranked

    feed_config.ai_requests_count += 1
    ai_cap = feed_config.weights.ai_adjustment_cap
    try:
        raw_adjustments = await rerank_func(
            _build_ai_user_context(current_user),
            [item.thread for item in shortlist],
            feed_config.ai_timeout_ms,
            ai_cap,
        )
        if not isinstance(raw_adjustments, dict):
            raise FeedAIRerankPayloadError("AI rerank payload must be a mapping")

        adjustments: dict[str, float] = {}
        for thread_id, value in raw_adjustments.items():
            key = str(thread_id)
            if key not in shortlist_ids:
                continue
            try:
                numeric = float(value)
            except (TypeError, ValueError) as exc:
                raise FeedAIRerankPayloadError("AI rerank adjustment is not numeric") from exc
            adjustments[key] = round(_clamp(numeric, -ai_cap, ai_cap), 6)
    except FeedAIRerankTimeoutError:
        feed_config.ai_timeout_count += 1
        feed_config.ai_fallback_count += 1
        await feed_config.save()
        return ranked
    except (FeedAIRerankPayloadError, FeedAIRerankError):
        feed_config.ai_error_count += 1
        feed_config.ai_fallback_count += 1
        await feed_config.save()
        return ranked
    except Exception:
        feed_config.ai_error_count += 1
        feed_config.ai_fallback_count += 1
        await feed_config.save()
        return ranked

    feed_config.ai_spend_today_usd = round(
        min(feed_config.ai_daily_budget_usd, feed_config.ai_spend_today_usd + _AI_UNIT_COST_USD),
        6,
    )
    await feed_config.save()

    if not adjustments:
        return ranked

    adjusted: list[FeedScoredThread] = []
    for item in ranked:
        adjustment = adjustments.get(str(item.thread.id), 0.0)
        if adjustment == 0.0:
            adjusted.append(item)
            continue
        reason_code = "ai_boost" if adjustment > 0 else "ai_penalty"
        reasons = [*item.reasons]
        if reason_code not in reasons:
            reasons.append(reason_code)
        breakdown = dict(item.breakdown)
        breakdown["ai_adjustment"] = round(adjustment, 4)
        adjusted.append(
            FeedScoredThread(
                thread=item.thread,
                score=round(item.score + adjustment, 6),
                reasons=reasons,
                breakdown=breakdown,
            )
        )

    adjusted.sort(key=_stable_sort_key)
    return adjusted


async def fetch_ranked_feed_slice(
    current_user: User,
    *,
    mode: str,
    limit: int,
    cursor: str | None,
    weights: FeedWeights,
    max_candidates: int = 500,
    max_per_author: int = 2,
    feed_config: FeedConfig | None = None,
    allow_ai: bool = False,
    settings: Settings | None = None,
    rerank_func: Callable[[dict[str, Any], list[Thread], int, float], Awaitable[dict[str, float]]] = rerank_shortlist,
) -> tuple[list[FeedScoredThread], str | None]:
    offset = decode_offset_cursor(cursor)

    query_filters: dict[str, object] = {"is_deleted": False, "feed_suppressed": {"$ne": True}}
    if mode == "following":
        if not current_user.following:
            return [], None
        query_filters["author_id"] = {"$in": current_user.following}

    threads = await Thread.find(query_filters).sort("-created_at").limit(max_candidates).to_list()
    visible_threads = apply_visibility_filters(threads, current_user)

    author_cap = 0 if mode == "following" else max_per_author
    ranked = rank_threads(visible_threads, current_user, weights, max_per_author=author_cap)
    if allow_ai:
        ranked = await _maybe_apply_ai_rerank(
            ranked,
            current_user=current_user,
            mode=mode,
            cursor=cursor,
            feed_config=feed_config,
            settings=settings,
            rerank_func=rerank_func,
        )

    page_data = ranked[offset : offset + limit]
    next_cursor = encode_offset_cursor(offset + limit) if (offset + limit) < len(ranked) else None
    return page_data, next_cursor


def explain_thread_for_user(thread: Thread, current_user: User, weights: FeedWeights) -> FeedScoredThread:
    return score_thread(thread, current_user, weights)
