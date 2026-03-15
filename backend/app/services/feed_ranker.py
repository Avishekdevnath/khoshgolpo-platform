from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.models.feed_config import FeedWeights
from app.models.thread import Thread
from app.models.user import User


@dataclass
class FeedScoredThread:
    thread: Thread
    score: float
    reasons: list[str]
    breakdown: dict[str, float]


def _clamp(value: float, minimum: float, maximum: float) -> float:
    if value < minimum:
        return minimum
    if value > maximum:
        return maximum
    return value


def _age_hours(created_at: datetime) -> float:
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    delta = now - created_at.astimezone(timezone.utc)
    return max(delta.total_seconds() / 3600, 0.0)


def _normalized_tag_set(tags: list[str]) -> set[str]:
    return {tag.strip().lower() for tag in tags if tag.strip()}


def score_thread(thread: Thread, current_user: User, weights: FeedWeights) -> FeedScoredThread:
    following = {str(item) for item in current_user.following}
    interest_tags = _normalized_tag_set(current_user.interest_tags)
    thread_tags = _normalized_tag_set(thread.tags)

    follow_signal = 1.0 if str(thread.author_id) in following else 0.0
    age_hours = _age_hours(thread.created_at)
    recency_signal = 1.0 / (1.0 + (age_hours / 12.0))
    engagement_signal = _clamp(thread.post_count / 20.0, 0.0, 1.0)
    interest_signal = (
        _clamp(len(interest_tags.intersection(thread_tags)) / max(len(thread_tags), 1), 0.0, 1.0)
        if thread_tags and interest_tags
        else 0.0
    )
    pin_signal = 1.0 if thread.is_pinned else 0.0
    quality_signal = 1.0 if thread.is_flagged else _clamp(float(thread.ai_score or 0.0), 0.0, 1.0)

    follow_part = weights.follow * follow_signal
    recency_part = weights.recency * recency_signal
    engagement_part = weights.engagement * engagement_signal
    interest_part = weights.interest * interest_signal
    pin_part = weights.pin * pin_signal
    quality_part = weights.quality_penalty * quality_signal
    manual_part = thread.feed_boost

    score = follow_part + recency_part + engagement_part + interest_part + pin_part + manual_part - quality_part

    reasons: list[str] = []
    if follow_signal > 0:
        reasons.append("followed_author")
    if interest_signal > 0:
        reasons.append("matched_interest")
    if recency_signal >= 0.8:
        reasons.append("fresh_topic")
    if pin_signal > 0:
        reasons.append("pinned")
    if thread.feed_boost > 0:
        reasons.append("manual_boost")
    elif thread.feed_boost < 0:
        reasons.append("manual_penalty")
    if quality_signal > 0 and quality_part > 0:
        reasons.append("quality_penalty")
    if not reasons:
        reasons.append("general_relevance")

    breakdown = {
        "follow": round(follow_part, 4),
        "recency": round(recency_part, 4),
        "engagement": round(engagement_part, 4),
        "interest": round(interest_part, 4),
        "pin": round(pin_part, 4),
        "manual_boost": round(manual_part, 4),
        "quality_penalty": round(-quality_part, 4),
    }

    return FeedScoredThread(
        thread=thread,
        score=round(score, 6),
        reasons=reasons,
        breakdown=breakdown,
    )


def rank_threads(
    threads: list[Thread],
    current_user: User,
    weights: FeedWeights,
    *,
    max_per_author: int = 2,
) -> list[FeedScoredThread]:
    scored = [score_thread(thread, current_user, weights) for thread in threads]
    scored.sort(
        key=lambda item: (
            -item.score,
            -item.thread.created_at.timestamp(),
            str(item.thread.id),
        )
    )

    if max_per_author <= 0:
        return scored

    kept: list[FeedScoredThread] = []
    author_counts: dict[str, int] = {}
    for item in scored:
        author_key = str(item.thread.author_id)
        count = author_counts.get(author_key, 0)
        if count >= max_per_author:
            continue
        author_counts[author_key] = count + 1
        kept.append(item)
    return kept
