from fastapi import APIRouter, Request

from app.core.config import get_settings
from app.core.database import ping_database

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(request: Request) -> dict[str, object]:
    settings = get_settings()
    db_connected = await ping_database()

    payload: dict[str, object] = {
        "status": "ok",
        "version": settings.api_version,
        "environment": settings.environment,
        "database": "connected" if db_connected else "disconnected",
    }

    db_error = getattr(request.app.state, "db_error", None)
    if db_error and not db_connected:
        payload["database_error"] = str(db_error)

    return payload
