from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db.models import AccessGrant, User
from app.db.session import get_db
from app.deps import get_current_user
from app.schemas import AccessGrantCreate, AccessGrantOut

router = APIRouter(prefix="/access-grants", tags=["access_grants"])


def _to_out(g: AccessGrant) -> AccessGrantOut:
    return AccessGrantOut(
        id=g.id,
        user_id=g.user_id,
        grantee_email=g.grantee_email,
        scope=g.scope,
        purpose=g.purpose,
        start_date=g.start_date,
        end_date=g.end_date,
        status=g.status,  # type: ignore[arg-type]
        created_at=g.created_at,
    )


@router.get("", response_model=list[AccessGrantOut])
def list_grants(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Mark expired grants (best-effort)
    today = date.today()
    active = (
        db.query(AccessGrant)
        .filter(AccessGrant.user_id == user.id, AccessGrant.status == "active")
        .all()
    )
    changed = False
    for g in active:
        if g.end_date and g.end_date < today:
            g.status = "expired"
            db.add(g)
            changed = True
    if changed:
        db.commit()

    grants = (
        db.query(AccessGrant)
        .filter(AccessGrant.user_id == user.id)
        .order_by(AccessGrant.created_at.desc(), AccessGrant.id.desc())
        .all()
    )

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="access_grants.read",
        entity_type="access_grant",
        entity_id=None,
        metadata=None,
    )

    return [_to_out(g) for g in grants]


@router.post("", response_model=AccessGrantOut)
def create_grant(
    payload: AccessGrantCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    grant = AccessGrant(
        user_id=user.id,
        grantee_email=payload.grantee_email,
        scope=payload.scope,
        purpose=payload.purpose,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="active",
    )
    db.add(grant)
    db.commit()
    db.refresh(grant)

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="access_grants.create",
        entity_type="access_grant",
        entity_id=grant.id,
        metadata={"grantee_email": grant.grantee_email, "scope": grant.scope},
    )

    return _to_out(grant)


@router.put("/{grant_id}/revoke", response_model=AccessGrantOut)
def revoke_grant(
    grant_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    grant = db.get(AccessGrant, grant_id)
    if not grant or grant.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grant not found")

    if grant.status != "revoked":
        grant.status = "revoked"
        db.add(grant)
        db.commit()
        db.refresh(grant)

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="access_grants.revoke",
        entity_type="access_grant",
        entity_id=grant.id,
        metadata={"grantee_email": grant.grantee_email},
    )

    return _to_out(grant)

