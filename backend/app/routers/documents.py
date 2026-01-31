from __future__ import annotations

from io import BytesIO

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db.models import Document, User
from app.db.session import get_db
from app.deps import get_current_user
from app.s3 import build_object_key, s3_client
from app.schemas import DocumentCategory, DocumentOut
from app.settings import settings

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/png", "image/jpeg"}


@router.get("", response_model=list[DocumentOut])
def list_documents(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = (
        db.query(Document)
        .filter(Document.user_id == user.id)
        .order_by(Document.upload_date.desc(), Document.id.desc())
        .all()
    )

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="documents.read",
        entity_type="document",
        entity_id=None,
        metadata=None,
    )

    return [
        DocumentOut(
            id=d.id,
            user_id=d.user_id,
            filename=d.filename,
            file_path=d.file_path,
            file_type=d.file_type,
            category=d.category,  # type: ignore[arg-type]
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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

    doc = Document(
        user_id=user.id,
        filename=file.filename,
        file_path=key,
        file_type=content_type,
        category=category,
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
        metadata={"filename": doc.filename, "category": doc.category, "file_size": doc.file_size},
    )

    return DocumentOut(
        id=doc.id,
        user_id=doc.user_id,
        filename=doc.filename,
        file_path=doc.file_path,
        file_type=doc.file_type,
        category=doc.category,  # type: ignore[arg-type]
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
    doc = db.get(Document, doc_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    s3 = s3_client()
    try:
        s3.delete_object(Bucket=settings.s3_bucket, Key=doc.file_path)
    except Exception:
        # still delete DB row for UX, since the goal is "gone"
        pass

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

