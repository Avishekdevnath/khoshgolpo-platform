from typing import Optional

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings
from app.models import DOCUMENT_MODELS

_client: Optional[AsyncIOMotorClient] = None
_database: Optional[AsyncIOMotorDatabase] = None


async def init_database() -> None:
    global _client, _database

    settings = get_settings()
    _client = AsyncIOMotorClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
        socketTimeoutMS=10000,
    )
    _database = _client[settings.mongodb_db_name]

    await init_beanie(database=_database, document_models=DOCUMENT_MODELS)


async def ping_database() -> bool:
    if _client is None:
        return False
    try:
        await _client.admin.command("ping")
        return True
    except Exception:
        return False


async def close_database() -> None:
    global _client, _database

    if _client is not None:
        _client.close()

    _client = None
    _database = None
