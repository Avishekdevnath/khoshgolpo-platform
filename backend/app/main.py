from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
from loguru import logger

from app.core.config import get_settings
from app.core.database import close_database, init_database
from app.core.logging import setup_logging
from app.routers import api_router
from app.services.bot_scheduler import start_scheduler, stop_scheduler

# Setup logging
setup_logging()

# Setup rate limiting
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.db_error = None
    try:
        await init_database()
        start_scheduler()
    except Exception as exc:
        # Keep app running so docs and stubs are usable even without Mongo running.
        app.state.db_error = str(exc)

    yield
    stop_scheduler()
    await close_database()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.api_version,
        lifespan=lifespan,
    )

    # Add state reference to limiter
    app.state.limiter = limiter

    # Add rate limit exception handler
    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request, exc):
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Too many requests."},
        )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)
    logger.info(f"KhoshGolpo API v{settings.api_version} initialized")
    return app


app = create_app()
