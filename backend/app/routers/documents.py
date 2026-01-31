from __future__ import annotations

import json
from io import BytesIO

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db.models import Document, User
from app.db.session import get_db
from app.deps import get_current_user
from app.s3 import build_object_key, s3_client
from app.schemas import DocumentCategory, DocumentOut
from app.settings import settings

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/png", "image/jpeg"}


@router.get("", response_model=list[DocumentOut])
def list_documents(
    request: Request,
    category: DocumentCategory | None = Query(default=None),
    tag: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List documents with optional category and tag filters."""
    q = db.query(Document).filter(Document.user_id == user.id)
    
    if category:
        q = q.filter(Document.category == category)
    
    docs = q.order_by(Document.upload_date.desc(), Document.id.desc()).all()
    
    # Filter by tag in Python (JSONB array filtering)
    if tag:
        docs = [d for d in docs if d.tags and tag in d.tags]

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="documents.read",
        entity_type="document",
        entity_id=None,
        metadata={"category": category, "tag": tag},
    )

    return [
        DocumentOut(
            id=d.id,
            user_id=d.user_id,
            filename=d.filename,
            file_path=d.file_path,
            file_type=d.file_type,
            category=d.category,  # type: ignore[arg-type]
            tags=d.tags,
            upload_date=d.upload_date,
            file_size=d.file_size,
        )
        for d in docs
    ]


@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    category: DocumentCategory = Form(...),
    tags: str | None = Form(default=None),  # JSON array string or comma-separated
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a document with optional tags."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type or 'unknown'}")

    blob = await file.read()
    size = len(blob)
    if size <= 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if size > settings.max_upload_bytes:
        raise HTTPException(status_code=400, detail="File too large")

    key = build_object_key(user_id=user.id, filename=file.filename)

    s3 = s3_client()
    s3.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=blob,
        ContentType=content_type,
    )

    # Parse tags
    parsed_tags: list[str] | None = None
    if tags:
        try:
            parsed_tags = json.loads(tags)
            if not isinstance(parsed_tags, list):
                parsed_tags = [str(t).strip() for t in tags.split(",") if t.strip()]
        except json.JSONDecodeError:
            parsed_tags = [t.strip() for t in tags.split(",") if t.strip()]

    doc = Document(
        user_id=user.id,
        filename=file.filename,
        file_path=key,
        file_type=content_type,
        category=category,
        tags=parsed_tags,
        file_size=size,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="documents.upload",
        entity_type="document",
        entity_id=doc.id,
        metadata={"filename": doc.filename, "category": doc.category, "tags": doc.tags, "file_size": doc.file_size},
    )

    return DocumentOut(
        id=doc.id,
        user_id=doc.user_id,
        filename=doc.filename,
        file_path=doc.file_path,
        file_type=doc.file_type,
        category=doc.category,  # type: ignore[arg-type]
        tags=doc.tags,
        upload_date=doc.upload_date,
        file_size=doc.file_size,
    )


@router.get("/{doc_id}")
def download_document(
    doc_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download a document."""
    doc = db.get(Document, doc_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    s3 = s3_client()
    try:
        obj = s3.get_object(Bucket=settings.s3_bucket, Key=doc.file_path)
    except Exception:
        raise HTTPException(status_code=404, detail="File missing from storage")

    body = obj["Body"].read()

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="documents.download",
        entity_type="document",
        entity_id=doc.id,
        metadata={"filename": doc.filename},
    )

    headers = {"Content-Disposition": f'attachment; filename="{doc.filename}"'}
    return StreamingResponse(
        BytesIO(body),
        media_type=doc.file_type,
        headers=headers,
    )


@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a document."""
    doc = db.get(Document, doc_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    s3 = s3_client()
    try:
        s3.delete_object(Bucket=settings.s3_bucket, Key=doc.file_path)
    except Exception:
        pass  # still delete DB row

    db.delete(doc)
    db.commit()

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="documents.delete",
        entity_type="document",
        entity_id=doc_id,
        metadata={"filename": doc.filename},
    )

    return {"ok": True}
