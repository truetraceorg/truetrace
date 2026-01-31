from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db.models import DataRecord, User
from app.db.session import get_db
from app.deps import get_current_user
from app.schemas import DataCategory, DataRecordCreate, DataRecordOut, DataRecordUpdate

router = APIRouter(prefix="/records", tags=["records"])


@router.get("", response_model=list[DataRecordOut])
def list_records(
    request: Request,
    category: DataCategory | None = Query(default=None),
    record_type: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List data records with optional filters."""
    q = db.query(DataRecord).filter(DataRecord.user_id == user.id)
    if category:
        q = q.filter(DataRecord.category == category)
    if record_type:
        q = q.filter(DataRecord.record_type == record_type)
    records = q.order_by(DataRecord.date.desc(), DataRecord.id.desc()).all()

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="records.read",
        entity_type="data_record",
        entity_id=None,
        metadata={"category": category, "record_type": record_type},
    )

    return [
        DataRecordOut(
            id=r.id,
            user_id=r.user_id,
            category=r.category,  # type: ignore[arg-type]
            record_type=r.record_type,
            data=r.data,
            date=r.date,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in records
    ]


@router.post("", response_model=DataRecordOut)
def create_record(
    payload: DataRecordCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new data record."""
    record = DataRecord(
        user_id=user.id,
        category=payload.category,
        record_type=payload.record_type,
        data=payload.data,
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
        action="records.create",
        entity_type="data_record",
        entity_id=record.id,
        metadata={"category": record.category, "record_type": record.record_type},
    )

    return DataRecordOut(
        id=record.id,
        user_id=record.user_id,
        category=record.category,  # type: ignore[arg-type]
        record_type=record.record_type,
        data=record.data,
        date=record.date,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.get("/{record_id}", response_model=DataRecordOut)
def get_record(
    record_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single data record."""
    record = db.get(DataRecord, record_id)
    if not record or record.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="records.read_one",
        entity_type="data_record",
        entity_id=record.id,
        metadata={"category": record.category, "record_type": record.record_type},
    )

    return DataRecordOut(
        id=record.id,
        user_id=record.user_id,
        category=record.category,  # type: ignore[arg-type]
        record_type=record.record_type,
        data=record.data,
        date=record.date,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.put("/{record_id}", response_model=DataRecordOut)
def update_record(
    record_id: int,
    payload: DataRecordUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a data record."""
    record = db.get(DataRecord, record_id)
    if not record or record.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    if payload.category is not None:
        record.category = payload.category
    if payload.record_type is not None:
        record.record_type = payload.record_type
    if payload.data is not None:
        record.data = payload.data
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
        action="records.update",
        entity_type="data_record",
        entity_id=record.id,
        metadata={"category": record.category, "record_type": record.record_type},
    )

    return DataRecordOut(
        id=record.id,
        user_id=record.user_id,
        category=record.category,  # type: ignore[arg-type]
        record_type=record.record_type,
        data=record.data,
        date=record.date,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.delete("/{record_id}")
def delete_record(
    record_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a data record."""
    record = db.get(DataRecord, record_id)
    if not record or record.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    category = record.category
    record_type = record.record_type

    db.delete(record)
    db.commit()

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="records.delete",
        entity_type="data_record",
        entity_id=record_id,
        metadata={"category": category, "record_type": record_type},
    )

    return {"ok": True}
