"""Logging configuration for KhoshGolpo API."""

import sys
from loguru import logger

from app.core.config import get_settings


def setup_logging() -> None:
    """Configure logging with loguru."""
    settings = get_settings()

    # Remove default handler
    logger.remove()

    # Add console handler with appropriate level
    log_level = "DEBUG" if settings.environment == "development" else "INFO"

    logger.add(
        sys.stdout,
        level=log_level,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
            "<level>{message}</level>"
        ),
    )

    # Add file logging in production
    if settings.environment in ("production", "staging"):
        logger.add(
            "logs/khoshgolpo.log",
            level="INFO",
            format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
            rotation="500 MB",
            retention="7 days",
        )


def get_logger(name: str) -> logger:
    """Get a logger instance with a specific name."""
    return logger.bind(name=name)
