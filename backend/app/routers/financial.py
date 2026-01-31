from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db.models import FinancialRecord, User
from app.db.session import get_db
from app.deps import get_current_user
from app.schemas import FinancialRecordCreate, FinancialRecordOut

router = APIRouter(prefix="/api/financial", tags=["financial"])


def _to_out(fr: FinancialRecord) -> FinancialRecordOut:
    return FinancialRecordOut(
        id=fr.id,
        user_id=fr.user_id,
        record_type=fr.record_type,
        data=fr.data,
        date=fr.date,
        created_at=fr.created_at,
        updated_at=fr.updated_at,
    )


@router.get("", response_model=list[FinancialRecordOut])
def list_financial(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(FinancialRecord)
        .filter(FinancialRecord.user_id == user.id)
        .order_by(FinancialRecord.date.desc(), FinancialRecord.id.desc())
        .all()
    )

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="financial.read",
        entity_type="financial_record",
        entity_id=None,
        metadata=None,
    )

    return [_to_out(fr) for fr in rows]


@router.post("", response_model=FinancialRecordOut)
def create_financial(
    payload: FinancialRecordCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    fr = FinancialRecord(
        user_id=user.id,
        record_type=payload.record_type,
        data=payload.data,
        date=payload.date,
        updated_at=now,
    )
    db.add(fr)
    db.commit()
    db.refresh(fr)

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="financial.create",
        entity_type="financial_record",
        entity_id=fr.id,
        metadata={"record_type": fr.record_type},
    )

    return _to_out(fr)

