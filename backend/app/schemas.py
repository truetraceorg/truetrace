from __future__ import annotations

from datetime import date as dt_date, datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


RecordType = Literal["medication", "vaccination", "lab_result", "condition", "allergy"]
DocumentCategory = Literal["medical", "financial", "legal"]
GrantStatus = Literal["active", "revoked", "expired"]


class UserOut(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime


class AuthRegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class AuthLoginIn(BaseModel):
    email: EmailStr
    password: str


class AuthTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MedicalRecordBase(BaseModel):
    record_type: RecordType
    data: dict[str, Any]
    date: dt_date


class MedicalRecordCreate(MedicalRecordBase):
    pass


class MedicalRecordUpdate(BaseModel):
    data: dict[str, Any] | None = None
    date: dt_date | None = None


class MedicalRecordOut(MedicalRecordBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime


class DocumentOut(BaseModel):
    id: int
    user_id: int
    filename: str
    file_path: str
    file_type: str
    category: DocumentCategory
    upload_date: datetime
    file_size: int


class AccessGrantCreate(BaseModel):
    grantee_email: EmailStr
    scope: str = Field(min_length=1, max_length=256)
    purpose: str | None = Field(default=None, max_length=512)
    start_date: dt_date | None = None
    end_date: dt_date | None = None


class AccessGrantOut(BaseModel):
    id: int
    user_id: int
    grantee_email: EmailStr
    scope: str
    purpose: str | None
    start_date: dt_date | None
    end_date: dt_date | None
    status: GrantStatus
    created_at: datetime


class AuditLogOut(BaseModel):
    id: int
    user_id: int
    action: str
    entity_type: str
    entity_id: str | None
    metadata: dict[str, Any] | None
    ip_address: str | None
    timestamp: datetime


class FinancialRecordCreate(BaseModel):
    record_type: str = Field(min_length=1, max_length=64)
    data: dict[str, Any]
    date: dt_date


class FinancialRecordOut(BaseModel):
    id: int
    user_id: int
    record_type: str
    data: dict[str, Any]
    date: dt_date
    created_at: datetime
    updated_at: datetime


class StatsOut(BaseModel):
    medical_counts: dict[str, int]
    document_counts: dict[str, int]
    recent_audit: list[AuditLogOut]
