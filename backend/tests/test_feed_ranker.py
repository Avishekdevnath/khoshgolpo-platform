from datetime import datetime, timezone

from beanie import PydanticObjectId

from app.models.feed_config import FeedWeights
from app.models.thread import Thread
from app.models.user import User
from app.services.feed_ranker import rank_threads


def _user(user_id: str = "65aa00000000000000000001") -> User:
    return User.model_construct(
        id=PydanticObjectId(user_id),
        username="reader",
        email="reader@example.com",
        display_name="Reader",
        following=[],
        muted_users=[],
        interest_tags=[],
        hidden_tags=[],
    )


def _thread(
    *,
    thread_id: str,
    author_id: str,
    created_at: datetime,
    feed_boost: float = 0.0,
) -> Thread:
    return Thread.model_construct(
        id=PydanticObjectId(thread_id),
        title=f"title-{thread_id[-4:]}",
        body="seed",
        tags=[],
        author_id=PydanticObjectId(author_id),
        created_at=created_at,
        updated_at=created_at,
        feed_boost=feed_boost,
        post_count=0,
        is_pinned=False,
        is_flagged=False,
        ai_score=None,
        is_deleted=False,
        feed_suppressed=False,
    )


def test_rank_threads_uses_deterministic_tiebreakers() -> None:
    now = datetime(2026, 3, 1, tzinfo=timezone.utc)
    viewer = _user()
    weights = FeedWeights()

    left = _thread(
        thread_id="65aa00000000000000000100",
        author_id="65aa00000000000000001000",
        created_at=now,
        feed_boost=0.0,
    )
    right = _thread(
        thread_id="65aa00000000000000000200",
        author_id="65aa00000000000000002000",
        created_at=now,
        feed_boost=0.0,
    )

    ranked = rank_threads([right, left], viewer, weights, max_per_author=0)
    assert [str(item.thread.id) for item in ranked] == [str(left.id), str(right.id)]


def test_rank_threads_enforces_per_author_cap() -> None:
    now = datetime(2026, 3, 1, tzinfo=timezone.utc)
    viewer = _user("65aa00000000000000000002")
    weights = FeedWeights()

    author_a = "65aa0000000000000000a001"
    author_b = "65aa0000000000000000b001"
    threads = [
        _thread(
            thread_id="65aa0000000000000000a101",
            author_id=author_a,
            created_at=now,
            feed_boost=1.0,
        ),
        _thread(
            thread_id="65aa0000000000000000a102",
            author_id=author_a,
            created_at=now,
            feed_boost=0.9,
        ),
        _thread(
            thread_id="65aa0000000000000000a103",
            author_id=author_a,
            created_at=now,
            feed_boost=0.8,
        ),
        _thread(
            thread_id="65aa0000000000000000b101",
            author_id=author_b,
            created_at=now,
            feed_boost=0.7,
        ),
    ]

    ranked = rank_threads(threads, viewer, weights, max_per_author=2)
    author_counts: dict[str, int] = {}
    for item in ranked:
        key = str(item.thread.author_id)
        author_counts[key] = author_counts.get(key, 0) + 1

    assert author_counts.get(author_a) == 2
    assert author_counts.get(author_b) == 1
