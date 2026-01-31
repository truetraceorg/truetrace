from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db.models import AuditLog, User
from app.db.session import get_db
from app.deps import get_current_user
from app.schemas import AuditLogOut

router = APIRouter(prefix="/api/audit", tags=["audit"])


def _to_out(a: AuditLog) -> AuditLogOut:
    return AuditLogOut(
        id=a.id,
        user_id=a.user_id,
        action=a.action,
        entity_type=a.entity_type,
        entity_id=a.entity_id,
        metadata=a.meta,
        ip_address=a.ip_address,
        timestamp=a.timestamp,
    )


@router.get("", response_model=list[AuditLogOut])
def list_audit(
    request: Request,
    action: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog).filter(AuditLog.user_id == user.id)
    if action:
        q = q.filter(AuditLog.action == action)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if start:
        q = q.filter(AuditLog.timestamp >= start)
    if end:
        q = q.filter(AuditLog.timestamp <= end)

    rows = q.order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).limit(limit).all()

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="audit.read",
        entity_type="audit_log",
        entity_id=None,
        metadata={"filters": {"action": action, "entity_type": entity_type, "start": str(start) if start else None, "end": str(end) if end else None, "limit": limit}},
    )

    return [_to_out(a) for a in rows]

