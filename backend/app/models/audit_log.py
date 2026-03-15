from datetime import datetime
from enum import Enum
from typing import Any

from beanie import Document, PydanticObjectId
from pydantic import Field

from app.models.common import utc_now


class AuditSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AuditResult(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"


class AuditLog(Document):
    action: str = Field(min_length=1, max_length=120)
    actor_id: PydanticObjectId | None = None
    target_type: str = Field(min_length=1, max_length=80)
    target_id: PydanticObjectId | None = None
    severity: AuditSeverity = AuditSeverity.INFO
    result: AuditResult = AuditResult.SUCCESS
    request_id: str | None = Field(default=None, max_length=120)
    ip: str | None = Field(default=None, max_length=64)
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "audit_logs"
        indexes = [
            "action",
            "target_type",
            "target_id",
            "actor_id",
            "severity",
            "result",
            "request_id",
            "created_at",
        ]
