"""WebAuthn helpers for passkey authentication."""
from __future__ import annotations

import secrets
from typing import Any

from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    AuthenticatorAttachment,
    ResidentKeyRequirement,
    UserVerificationRequirement,
    PublicKeyCredentialDescriptor,
    AuthenticatorTransport,
)

from app.settings import settings

# In-memory challenge storage (production would use Redis)
# Maps email -> challenge bytes
_challenges: dict[str, bytes] = {}


def store_challenge(email: str, challenge: bytes) -> None:
    """Store a challenge for an email."""
    _challenges[email] = challenge


def get_challenge(email: str) -> bytes | None:
    """Retrieve and remove a challenge for an email."""
    return _challenges.pop(email, None)


def generate_registration_options_for_user(email: str, user_id: int) -> dict[str, Any]:
    """Generate WebAuthn registration options."""
    options = generate_registration_options(
        rp_id=settings.webauthn_rp_id,
        rp_name=settings.webauthn_rp_name,
        user_id=str(user_id).encode(),
        user_name=email,
        user_display_name=email,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )
    
    # Store challenge for verification
    store_challenge(email, options.challenge)
    
    # Convert to JSON-serializable dict
    return {
        "challenge": bytes_to_base64url(options.challenge),
        "rp": {"id": options.rp.id, "name": options.rp.name},
        "user": {
            "id": bytes_to_base64url(options.user.id),
            "name": options.user.name,
            "displayName": options.user.display_name,
        },
        "pubKeyCredParams": [
            {"type": p.type, "alg": p.alg} for p in options.pub_key_cred_params
        ],
        "timeout": options.timeout,
        "authenticatorSelection": {
            "authenticatorAttachment": options.authenticator_selection.authenticator_attachment.value if options.authenticator_selection and options.authenticator_selection.authenticator_attachment else None,
            "residentKey": options.authenticator_selection.resident_key.value if options.authenticator_selection and options.authenticator_selection.resident_key else None,
            "userVerification": options.authenticator_selection.user_verification.value if options.authenticator_selection and options.authenticator_selection.user_verification else None,
        },
        "attestation": options.attestation.value if options.attestation else "none",
    }


def generate_registration_options_for_new_user(email: str) -> dict[str, Any]:
    """Generate WebAuthn registration options for a new user (before user exists)."""
    # Use a temporary ID that will be replaced when user is created
    temp_id = secrets.token_bytes(32)
    
    options = generate_registration_options(
        rp_id=settings.webauthn_rp_id,
        rp_name=settings.webauthn_rp_name,
        user_id=temp_id,
        user_name=email,
        user_display_name=email,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )
    
    # Store challenge for verification
    store_challenge(email, options.challenge)
    
    # Convert to JSON-serializable dict
    return {
        "challenge": bytes_to_base64url(options.challenge),
        "rp": {"id": options.rp.id, "name": options.rp.name},
        "user": {
            "id": bytes_to_base64url(options.user.id),
            "name": options.user.name,
            "displayName": options.user.display_name,
        },
        "pubKeyCredParams": [
            {"type": p.type, "alg": p.alg} for p in options.pub_key_cred_params
        ],
        "timeout": options.timeout,
        "authenticatorSelection": {
            "authenticatorAttachment": options.authenticator_selection.authenticator_attachment.value if options.authenticator_selection and options.authenticator_selection.authenticator_attachment else None,
            "residentKey": options.authenticator_selection.resident_key.value if options.authenticator_selection and options.authenticator_selection.resident_key else None,
            "userVerification": options.authenticator_selection.user_verification.value if options.authenticator_selection and options.authenticator_selection.user_verification else None,
        },
        "attestation": options.attestation.value if options.attestation else "none",
    }


def verify_registration(email: str, credential: dict[str, Any]) -> dict[str, Any]:
    """Verify a WebAuthn registration response and return credential data."""
    challenge = get_challenge(email)
    if not challenge:
        raise ValueError("No challenge found for email")
    
    verification = verify_registration_response(
        credential=credential,
        expected_challenge=challenge,
        expected_rp_id=settings.webauthn_rp_id,
        expected_origin=settings.webauthn_origin,
    )
    
    return {
        "credential_id": verification.credential_id,
        "public_key": verification.credential_public_key,
        "counter": verification.sign_count,
        "transports": credential.get("response", {}).get("transports", []),
    }


def generate_authentication_options_for_user(
    email: str,
    credentials: list[tuple[bytes, list[str] | None]],
) -> dict[str, Any]:
    """Generate WebAuthn authentication options for existing credentials."""
    allow_credentials = []
    for cred_id, transports in credentials:
        descriptor = PublicKeyCredentialDescriptor(
            id=cred_id,
            transports=[AuthenticatorTransport(t) for t in (transports or [])],
        )
        allow_credentials.append(descriptor)
    
    options = generate_authentication_options(
        rp_id=settings.webauthn_rp_id,
        allow_credentials=allow_credentials,
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    
    # Store challenge for verification
    store_challenge(email, options.challenge)
    
    return {
        "challenge": bytes_to_base64url(options.challenge),
        "rpId": settings.webauthn_rp_id,
        "timeout": options.timeout,
        "allowCredentials": [
            {
                "id": bytes_to_base64url(c.id),
                "type": c.type,
                "transports": [t.value for t in c.transports] if c.transports else [],
            }
            for c in allow_credentials
        ],
        "userVerification": options.user_verification.value if options.user_verification else "preferred",
    }


def verify_authentication(
    email: str,
    credential: dict[str, Any],
    stored_public_key: bytes,
    stored_counter: int,
) -> int:
    """Verify a WebAuthn authentication response and return the new counter."""
    challenge = get_challenge(email)
    if not challenge:
        raise ValueError("No challenge found for email")
    
    # Extract credential_id from the credential response
    credential_id = base64url_to_bytes(credential.get("id", ""))
    
    verification = verify_authentication_response(
        credential=credential,
        expected_challenge=challenge,
        expected_rp_id=settings.webauthn_rp_id,
        expected_origin=settings.webauthn_origin,
        credential_public_key=stored_public_key,
        credential_current_sign_count=stored_counter,
    )
    
    return verification.new_sign_count
