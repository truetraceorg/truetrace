from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db.models import MedicalRecord, User
from app.db.session import get_db
from app.deps import get_current_user
from app.schemas import MedicalRecordCreate, MedicalRecordOut, MedicalRecordUpdate, RecordType
from app.validation import validate_record_data

router = APIRouter(prefix="/api/medical", tags=["medical"])


@router.get("", response_model=list[MedicalRecordOut])
def list_medical(
    request: Request,
    record_type: RecordType | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(MedicalRecord).filter(MedicalRecord.user_id == user.id)
    if record_type:
        q = q.filter(MedicalRecord.record_type == record_type)
    records = q.order_by(MedicalRecord.date.desc(), MedicalRecord.id.desc()).all()

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="medical.read",
        entity_type="medical_record",
        entity_id=None,
        metadata={"record_type": record_type} if record_type else None,
    )

    return [
        MedicalRecordOut(
            id=r.id,
            user_id=r.user_id,
            record_type=r.record_type,  # type: ignore[arg-type]
            data=r.data,
            date=r.date,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in records
    ]


@router.post("", response_model=MedicalRecordOut)
def create_medical(
    payload: MedicalRecordCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        normalized = validate_record_data(payload.record_type, payload.data)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())

    record = MedicalRecord(
        user_id=user.id,
        record_type=payload.record_type,
        data=normalized,
        date=payload.date,
        updated_at=datetime.now(timezone.utc),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="medical.create",
        entity_type="medical_record",
        entity_id=record.id,
        metadata={"record_type": record.record_type},
    )

    return MedicalRecordOut(
        id=record.id,
        user_id=record.user_id,
        record_type=record.record_type,  # type: ignore[arg-type]
        data=record.data,
        date=record.date,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.put("/{record_id}", response_model=MedicalRecordOut)
def update_medical(
    record_id: int,
    payload: MedicalRecordUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.get(MedicalRecord, record_id)
    if not record or record.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    if payload.data is not None:
        try:
            normalized = validate_record_data(record.record_type, payload.data)  # type: ignore[arg-type]
        except ValidationError as e:
            raise HTTPException(status_code=422, detail=e.errors())
        record.data = normalized

    if payload.date is not None:
        record.date = payload.date

    record.updated_at = datetime.now(timezone.utc)
    db.add(record)
    db.commit()
    db.refresh(record)

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="medical.update",
        entity_type="medical_record",
        entity_id=record.id,
        metadata={"record_type": record.record_type},
    )

    return MedicalRecordOut(
        id=record.id,
        user_id=record.user_id,
        record_type=record.record_type,  # type: ignore[arg-type]
        data=record.data,
        date=record.date,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.delete("/{record_id}")
def delete_medical(
    record_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.get(MedicalRecord, record_id)
    if not record or record.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    db.delete(record)
    db.commit()

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="medical.delete",
        entity_type="medical_record",
        entity_id=record_id,
        metadata={"record_type": record.record_type},
    )

    return {"ok": True}

