from __future__ import annotations

from datetime import date as dt_date, datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


DataCategory = Literal["medical", "financial", "legal", "identity"]
DocumentCategory = Literal["medical", "financial", "legal", "identity"]
GrantStatus = Literal["active", "revoked", "expired"]


# User schemas
class UserOut(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime


# WebAuthn schemas
class WebAuthnBeginIn(BaseModel):
    email: EmailStr


class WebAuthnRegisterCompleteIn(BaseModel):
    email: EmailStr
    credential: dict[str, Any]


class WebAuthnLoginCompleteIn(BaseModel):
    email: EmailStr
    credential: dict[str, Any]


class AuthTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CredentialOut(BaseModel):
    id: int
    created_at: datetime


# Data Record schemas
class DataRecordBase(BaseModel):
    category: DataCategory
    record_type: str = Field(min_length=1, max_length=64)
    data: dict[str, Any]
    date: dt_date


class DataRecordCreate(DataRecordBase):
    pass


class DataRecordUpdate(BaseModel):
    category: DataCategory | None = None
    record_type: str | None = Field(default=None, min_length=1, max_length=64)
    data: dict[str, Any] | None = None
    date: dt_date | None = None


class DataRecordOut(DataRecordBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime


# Document schemas
class DocumentOut(BaseModel):
    id: int
    user_id: int
    filename: str
    file_path: str
    file_type: str
    category: DocumentCategory
    tags: list[str] | None
    upload_date: datetime
    file_size: int


# Access Grant schemas
class AccessGrantCreate(BaseModel):
    grantee_identifier: str = Field(min_length=1, max_length=320)
    scope: str = Field(min_length=1, max_length=256)
    purpose: str | None = Field(default=None, max_length=512)
    start_date: dt_date | None = None
    end_date: dt_date | None = None


class AccessGrantOut(BaseModel):
    id: int
    user_id: int
    grantee_identifier: str
    scope: str
    purpose: str | None
    start_date: dt_date | None
    end_date: dt_date | None
    status: GrantStatus
    created_at: datetime


# Audit Log schemas
class AuditLogOut(BaseModel):
    id: int
    user_id: int
    action: str
    entity_type: str
    entity_id: str | None
    metadata: dict[str, Any] | None
    ip_address: str | None
    timestamp: datetime


# Stats schemas
class StatsOut(BaseModel):
    category_counts: dict[str, int]
    document_counts: dict[str, int]
    recent_audit: list[AuditLogOut]
