from __future__ import annotations

from typing import Any

from beanie import PydanticObjectId

from app.models.audit_log import AuditLog, AuditResult, AuditSeverity


async def log_audit(
    *,
    action: str,
    target_type: str,
    actor_id: PydanticObjectId | str | None = None,
    target_id: PydanticObjectId | str | None = None,
    severity: AuditSeverity = AuditSeverity.INFO,
    result: AuditResult = AuditResult.SUCCESS,
    request_id: str | None = None,
    ip: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Write an audit log row. Invalid object-id inputs are ignored safely."""

    def _coerce_object_id(value: PydanticObjectId | str | None) -> PydanticObjectId | None:
        if value is None:
            return None
        if isinstance(value, PydanticObjectId):
            return value
        try:
            return PydanticObjectId(value)
        except Exception:
            return None

    await AuditLog(
        action=action,
        actor_id=_coerce_object_id(actor_id),
        target_type=target_type,
        target_id=_coerce_object_id(target_id),
        severity=severity,
        result=result,
        request_id=request_id,
        ip=ip,
        details=details or {},
    ).insert()

