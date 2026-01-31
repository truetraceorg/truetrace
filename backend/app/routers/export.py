from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db.models import AccessGrant, Document, FinancialRecord, MedicalRecord, User
from app.db.session import get_db
from app.deps import get_current_user

router = APIRouter(prefix="/export", tags=["export"])


def _iso(dt: Any) -> Any:
    if isinstance(dt, (datetime,)):
        return dt.astimezone(timezone.utc).isoformat()
    return dt


@router.get("/json")
def export_json(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    medical = (
        db.query(MedicalRecord)
        .filter(MedicalRecord.user_id == user.id)
        .order_by(MedicalRecord.date.desc(), MedicalRecord.id.desc())
        .all()
    )
    documents = (
        db.query(Document)
        .filter(Document.user_id == user.id)
        .order_by(Document.upload_date.desc(), Document.id.desc())
        .all()
    )
    grants = (
        db.query(AccessGrant)
        .filter(AccessGrant.user_id == user.id)
        .order_by(AccessGrant.created_at.desc(), AccessGrant.id.desc())
        .all()
    )
    financial = (
        db.query(FinancialRecord)
        .filter(FinancialRecord.user_id == user.id)
        .order_by(FinancialRecord.date.desc(), FinancialRecord.id.desc())
        .all()
    )

    payload: dict[str, Any] = {
        "user": {"id": user.id, "email": user.email, "created_at": _iso(user.created_at)},
        "medical_records": [
            {
                "id": r.id,
                "record_type": r.record_type,
                "date": r.date.isoformat(),
                "data": r.data,
                "created_at": _iso(r.created_at),
                "updated_at": _iso(r.updated_at),
            }
            for r in medical
        ],
        "documents": [
            {
                "id": d.id,
                "filename": d.filename,
                "file_path": d.file_path,
                "file_type": d.file_type,
                "category": d.category,
                "upload_date": _iso(d.upload_date),
                "file_size": d.file_size,
            }
            for d in documents
        ],
        "access_grants": [
            {
                "id": g.id,
                "grantee_email": g.grantee_email,
                "scope": g.scope,
                "purpose": g.purpose,
                "start_date": g.start_date.isoformat() if g.start_date else None,
                "end_date": g.end_date.isoformat() if g.end_date else None,
                "status": g.status,
                "created_at": _iso(g.created_at),
            }
            for g in grants
        ],
        "financial_records": [
            {
                "id": fr.id,
                "record_type": fr.record_type,
                "date": fr.date.isoformat(),
                "data": fr.data,
                "created_at": _iso(fr.created_at),
                "updated_at": _iso(fr.updated_at),
            }
            for fr in financial
        ],
    }

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="export.json",
        entity_type="export",
        entity_id=None,
        metadata={"counts": {"medical": len(medical), "documents": len(documents), "grants": len(grants), "financial": len(financial)}},
    )

    return payload


def _bundle_entry(resource: dict[str, Any]) -> dict[str, Any]:
    return {"resource": resource}


@router.get("/fhir")
def export_fhir(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Minimal, best-effort FHIR R4-ish Bundle. Not guaranteed validated/compliant.
    records = (
        db.query(MedicalRecord)
        .filter(MedicalRecord.user_id == user.id, MedicalRecord.record_type.in_(["medication", "vaccination", "lab_result"]))
        .order_by(MedicalRecord.date.asc(), MedicalRecord.id.asc())
        .all()
    )

    patient_id = f"patient-{user.id}"
    entries: list[dict[str, Any]] = [
        _bundle_entry(
            {
                "resourceType": "Patient",
                "id": patient_id,
                "identifier": [{"system": "urn:medvault:user-id", "value": str(user.id)}],
            }
        )
    ]

    for r in records:
        if r.record_type == "medication":
            entries.append(
                _bundle_entry(
                    {
                        "resourceType": "MedicationStatement",
                        "id": f"medication-{r.id}",
                        "status": "active",
                        "subject": {"reference": f"Patient/{patient_id}"},
                        "effectiveDateTime": r.date.isoformat(),
                        "medicationCodeableConcept": {"text": (r.data or {}).get("name")},
                        "note": [{"text": (r.data or {}).get("notes")}] if (r.data or {}).get("notes") else [],
                    }
                )
            )
        elif r.record_type == "vaccination":
            entries.append(
                _bundle_entry(
                    {
                        "resourceType": "Immunization",
                        "id": f"immunization-{r.id}",
                        "status": "completed",
                        "patient": {"reference": f"Patient/{patient_id}"},
                        "occurrenceDateTime": r.date.isoformat(),
                        "vaccineCode": {"text": (r.data or {}).get("vaccine_name")},
                        "manufacturer": {"display": (r.data or {}).get("manufacturer")} if (r.data or {}).get("manufacturer") else None,
                        "lotNumber": (r.data or {}).get("lot_number"),
                    }
                )
            )
        elif r.record_type == "lab_result":
            results = (r.data or {}).get("results") or []
            # Best-effort: emit one Observation per parameter if present, otherwise one summary Observation.
            if isinstance(results, list) and results:
                for idx, item in enumerate(results):
                    entries.append(
                        _bundle_entry(
                            {
                                "resourceType": "Observation",
                                "id": f"observation-{r.id}-{idx}",
                                "status": "final",
                                "subject": {"reference": f"Patient/{patient_id}"},
                                "effectiveDateTime": r.date.isoformat(),
                                "code": {"text": (item or {}).get("parameter") or (r.data or {}).get("test_name")},
                                "valueString": f"{(item or {}).get('value')}{(' ' + (item or {}).get('unit')) if (item or {}).get('unit') else ''}",
                                "interpretation": [{"text": (item or {}).get("status")}] if (item or {}).get("status") else [],
                                "referenceRange": [{"text": (item or {}).get("reference_range")}] if (item or {}).get("reference_range") else [],
                            }
                        )
                    )
            else:
                entries.append(
                    _bundle_entry(
                        {
                            "resourceType": "Observation",
                            "id": f"observation-{r.id}",
                            "status": "final",
                            "subject": {"reference": f"Patient/{patient_id}"},
                            "effectiveDateTime": r.date.isoformat(),
                            "code": {"text": (r.data or {}).get("test_name")},
                            "valueString": "See attached lab result data",
                        }
                    )
                )

    bundle = {
        "resourceType": "Bundle",
        "type": "collection",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "entry": entries,
    }

    log_audit(
        db=db,
        request=request,
        user_id=user.id,
        action="export.fhir",
        entity_type="export",
        entity_id=None,
        metadata={"counts": {"medical_included": len(records)}},
    )

    return bundle

