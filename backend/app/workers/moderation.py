import asyncio

from app.core.database import init_database
from app.models.post import Post
from app.services.ai import score_content
from app.workers.celery_app import celery_app


@celery_app.task(name="moderate_post")
def moderate_post(post_id: str) -> dict[str, object]:
    return asyncio.run(_moderate_post_async(post_id))


async def _moderate_post_async(post_id: str) -> dict[str, object]:
    await init_database()

    post = await Post.get(post_id)
    if post is None:
        return {"ok": False, "detail": "Post not found"}

    result = score_content(post.content)
    post.ai_score = result.score
    post.is_flagged = result.flagged
    await post.save()

    return {
        "ok": True,
        "post_id": post_id,
        "ai_score": result.score,
        "is_flagged": result.flagged,
        "reason": result.reason,
    }
