from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db.models import User, WebAuthnCredential
from app.db.session import get_db
from app.deps import get_current_user
from app.schemas import (
    AuthTokenOut,
    CredentialOut,
    UserOut,
    WebAuthnBeginIn,
    WebAuthnLoginCompleteIn,
    WebAuthnRegisterCompleteIn,
)
from app.security import create_access_token
from app.webauthn import (
    generate_authentication_options_for_user,
    generate_registration_options_for_new_user,
    generate_registration_options_for_user,
    verify_authentication,
    verify_registration,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register/begin")
def register_begin(payload: WebAuthnBeginIn, db: Session = Depends(get_db)):
    """Start WebAuthn registration flow."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    options = generate_registration_options_for_new_user(payload.email)
    return options


@router.post("/register/complete", response_model=AuthTokenOut)
def register_complete(
    payload: WebAuthnRegisterCompleteIn,
    request: Request,
    db: Session = Depends(get_db),
):
    """Complete WebAuthn registration and create user."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    try:
        cred_data = verify_registration(payload.email, payload.credential)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Registration verification failed: {e}")
    
    # Create user
    user = User(email=payload.email)
    db.add(user)
    db.flush()  # Get user ID
    
    # Create credential
    credential = WebAuthnCredential(
        user_id=user.id,
        credential_id=cred_data["credential_id"],
        public_key=cred_data["public_key"],
        counter=cred_data["counter"],
        transports=cred_data["transports"],
    )
    db.add(credential)
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


@router.post("/login/begin")
def login_begin(payload: WebAuthnBeginIn, db: Session = Depends(get_db)):
    """Start WebAuthn authentication flow."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    credentials = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.user_id == user.id
    ).all()
    
    if not credentials:
        raise HTTPException(status_code=400, detail="No passkeys registered")
    
    cred_list = [(c.credential_id, c.transports) for c in credentials]
    options = generate_authentication_options_for_user(payload.email, cred_list)
    return options


@router.post("/login/complete", response_model=AuthTokenOut)
def login_complete(
    payload: WebAuthnLoginCompleteIn,
    request: Request,
    db: Session = Depends(get_db),
):
    """Complete WebAuthn authentication and issue JWT."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Find the credential used
    from webauthn.helpers import base64url_to_bytes
    credential_id = base64url_to_bytes(payload.credential.get("id", ""))
    
    stored_cred = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.credential_id == credential_id,
        WebAuthnCredential.user_id == user.id,
    ).first()
    
    if not stored_cred:
        raise HTTPException(status_code=401, detail="Invalid credential")
    
    try:
        new_counter = verify_authentication(
            payload.email,
            payload.credential,
            stored_cred.public_key,
            stored_cred.counter,
        )
        stored_cred.counter = new_counter
        db.commit()
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")
    
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
    """Get current user info."""
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


@router.post("/logout")
def logout(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Log out (audit only - JWT is stateless)."""
    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="auth.logout",
        entity_type="user",
        entity_id=user.id,
        metadata=None,
    )
    return {"message": "Logged out"}


@router.get("/credentials", response_model=list[CredentialOut])
def list_credentials(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List user's registered passkeys."""
    credentials = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.user_id == user.id
    ).all()
    
    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="auth.list_credentials",
        entity_type="credential",
        entity_id=None,
        metadata=None,
    )
    
    return [CredentialOut(id=c.id, created_at=c.created_at) for c in credentials]


@router.post("/credentials/add/begin")
def add_credential_begin(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start adding a new passkey to existing account."""
    options = generate_registration_options_for_user(user.email, user.id)
    return options


@router.post("/credentials/add/complete", response_model=CredentialOut)
def add_credential_complete(
    payload: WebAuthnRegisterCompleteIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Complete adding a new passkey."""
    # Verify the email matches the authenticated user
    if payload.email != user.email:
        raise HTTPException(status_code=400, detail="Email mismatch")
    
    try:
        cred_data = verify_registration(payload.email, payload.credential)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Registration verification failed: {e}")
    
    # Check if credential already exists
    existing = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.credential_id == cred_data["credential_id"]
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Credential already registered")
    
    credential = WebAuthnCredential(
        user_id=user.id,
        credential_id=cred_data["credential_id"],
        public_key=cred_data["public_key"],
        counter=cred_data["counter"],
        transports=cred_data["transports"],
    )
    db.add(credential)
    db.commit()
    db.refresh(credential)
    
    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="auth.add_credential",
        entity_type="credential",
        entity_id=credential.id,
        metadata=None,
    )
    
    return CredentialOut(id=credential.id, created_at=credential.created_at)


@router.delete("/credentials/{credential_id}")
def delete_credential(
    credential_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a passkey."""
    credential = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.id == credential_id,
        WebAuthnCredential.user_id == user.id,
    ).first()
    
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    # Ensure user has at least one credential remaining
    cred_count = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.user_id == user.id
    ).count()
    
    if cred_count <= 1:
        raise HTTPException(status_code=400, detail="Cannot remove last passkey")
    
    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="auth.delete_credential",
        entity_type="credential",
        entity_id=credential_id,
        metadata=None,
    )
    
    db.delete(credential)
    db.commit()
    
    return {"message": "Credential deleted"}
