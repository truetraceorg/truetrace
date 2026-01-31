from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db.models import AuditLog, DataRecord, Document, User
from app.db.session import get_db
from app.deps import get_current_user
from app.schemas import AuditLogOut, StatsOut

router = APIRouter(prefix="/stats", tags=["stats"])


def _audit_out(a: AuditLog) -> AuditLogOut:
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


@router.get("", response_model=StatsOut)
def stats(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get dashboard statistics."""
    # Count records by category
    category_counts_rows = (
        db.query(DataRecord.category, func.count(DataRecord.id))
        .filter(DataRecord.user_id == user.id)
        .group_by(DataRecord.category)
        .all()
    )
    category_counts = {cat: int(cnt) for cat, cnt in category_counts_rows}

    # Count documents by category
    doc_counts_rows = (
        db.query(Document.category, func.count(Document.id))
        .filter(Document.user_id == user.id)
        .group_by(Document.category)
        .all()
    )
    document_counts = {cat: int(cnt) for cat, cnt in doc_counts_rows}

    # Recent audit entries
    recent = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == user.id)
        .order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
        .limit(10)
        .all()
    )

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="stats.read",
        entity_type="stats",
        entity_id=None,
        metadata=None,
    )

    return StatsOut(
        category_counts=category_counts,
        document_counts=document_counts,
        recent_audit=[_audit_out(a) for a in recent],
    )
