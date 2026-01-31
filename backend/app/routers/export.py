from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db.models import AccessGrant, DataRecord, Document, User
from app.db.session import get_db
from app.deps import get_current_user

router = APIRouter(prefix="/export", tags=["export"])


def _iso(dt: Any) -> Any:
    if isinstance(dt, (datetime,)):
        return dt.astimezone(timezone.utc).isoformat()
    return dt


@router.get("/json")
def export_json(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export all user data as JSON."""
    records = (
        db.query(DataRecord)
        .filter(DataRecord.user_id == user.id)
        .order_by(DataRecord.date.desc(), DataRecord.id.desc())
        .all()
    )
    documents = (
        db.query(Document)
        .filter(Document.user_id == user.id)
        .order_by(Document.upload_date.desc(), Document.id.desc())
        .all()
    )
    grants = (
        db.query(AccessGrant)
        .filter(AccessGrant.user_id == user.id)
        .order_by(AccessGrant.created_at.desc(), AccessGrant.id.desc())
        .all()
    )

    payload: dict[str, Any] = {
        "user": {"id": user.id, "email": user.email, "created_at": _iso(user.created_at)},
        "data_records": [
            {
                "id": r.id,
                "category": r.category,
                "record_type": r.record_type,
                "date": r.date.isoformat(),
                "data": r.data,
                "created_at": _iso(r.created_at),
                "updated_at": _iso(r.updated_at),
            }
            for r in records
        ],
        "documents": [
            {
                "id": d.id,
                "filename": d.filename,
                "file_path": d.file_path,
                "file_type": d.file_type,
                "category": d.category,
                "tags": d.tags,
                "upload_date": _iso(d.upload_date),
                "file_size": d.file_size,
            }
            for d in documents
        ],
        "access_grants": [
            {
                "id": g.id,
                "grantee_identifier": g.grantee_identifier,
                "scope": g.scope,
                "purpose": g.purpose,
                "start_date": g.start_date.isoformat() if g.start_date else None,
                "end_date": g.end_date.isoformat() if g.end_date else None,
                "status": g.status,
                "created_at": _iso(g.created_at),
            }
            for g in grants
        ],
    }

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="export.json",
        entity_type="export",
        entity_id=None,
        metadata={"counts": {"records": len(records), "documents": len(documents), "grants": len(grants)}},
    )

    return payload


@router.get("/csv")
def export_csv(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export data records as CSV."""
    records = (
        db.query(DataRecord)
        .filter(DataRecord.user_id == user.id)
        .order_by(DataRecord.category, DataRecord.date.desc(), DataRecord.id.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "category", "record_type", "date", "data", "created_at", "updated_at"])
    
    for r in records:
        writer.writerow([
            r.id,
            r.category,
            r.record_type,
            r.date.isoformat(),
            str(r.data),
            _iso(r.created_at),
            _iso(r.updated_at),
        ])

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="export.csv",
        entity_type="export",
        entity_id=None,
        metadata={"record_count": len(records)},
    )

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="civitas_export.csv"'},
    )
