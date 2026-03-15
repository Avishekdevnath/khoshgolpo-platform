from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.audit_log import AuditResult, AuditSeverity


class AuditLogOut(BaseModel):
    id: str
    action: str
    actor_id: str | None
    actor_username: str | None = None
    actor_display_name: str | None = None
    target_type: str
    target_id: str | None
    target_display_name: str | None = None
    severity: AuditSeverity
    result: AuditResult
    request_id: str | None
    ip: str | None
    details: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
