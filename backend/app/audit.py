from __future__ import annotations

from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.db.models import AuditLog
from app.deps import get_client_ip


def log_audit(
    *,
    db: Session,
    request: Request,
    user_id: int,
    action: str,
    entity_type: str,
    entity_id: str | int | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    audit = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        meta=metadata,
        ip_address=get_client_ip(request),
    )
    db.add(audit)
    db.commit()
