from fastapi import APIRouter

from app.routers.admin import router as admin_router
from app.routers.admin_feed import router as admin_feed_router
from app.routers.auth import router as auth_router
from app.routers.bot import router as bot_router
from app.routers.ai import router as ai_router
from app.routers.channels import router as channels_router
from app.routers.connections import router as connections_router
from app.routers.feed import router as feed_router
from app.routers.health import router as health_router
from app.routers.messages import router as messages_router
from app.routers.notifications import router as notifications_router
from app.routers.posts import router as posts_router
from app.routers.threads import router as threads_router
from app.routers.users import router as users_router

api_router = APIRouter()
api_router.include_router(admin_router)
api_router.include_router(admin_feed_router)
api_router.include_router(bot_router)
api_router.include_router(auth_router)
api_router.include_router(ai_router)
api_router.include_router(health_router)
api_router.include_router(feed_router)
api_router.include_router(threads_router)
api_router.include_router(posts_router)
api_router.include_router(users_router)
api_router.include_router(notifications_router)
api_router.include_router(messages_router)
api_router.include_router(channels_router)
api_router.include_router(connections_router)

__all__ = ["api_router"]
