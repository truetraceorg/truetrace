from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db.models import User
from app.db.session import get_db
from app.schemas import (
    AuthLoginIn,
    AuthRegisterIn,
    AuthTokenOut,
    UserOut,
)
from app.security import create_access_token, hash_password, verify_password
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthTokenOut)
def register(payload: AuthRegisterIn, request: Request, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="auth.register",
        entity_type="user",
        entity_id=user.id,
        metadata={"email": user.email},
    )

    token = create_access_token(sub=str(user.id))
    return AuthTokenOut(access_token=token)


@router.post("/login", response_model=AuthTokenOut)
def login(payload: AuthLoginIn, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="auth.login",
        entity_type="user",
        entity_id=user.id,
        metadata=None,
    )

    token = create_access_token(sub=str(user.id))
    return AuthTokenOut(access_token=token)


@router.get("/me", response_model=UserOut)
def me(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="auth.me",
        entity_type="user",
        entity_id=user.id,
        metadata=None,
    )
    return UserOut(id=user.id, email=user.email, created_at=user.created_at)

