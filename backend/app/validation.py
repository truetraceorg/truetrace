from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError

RecordType = Literal["medication", "vaccination", "lab_result", "condition", "allergy"]


class MedicationData(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    dosage: str | None = Field(default=None, max_length=200)
    frequency: str | None = Field(default=None, max_length=200)
    doctor: str | None = Field(default=None, max_length=200)
    pharmacy: str | None = Field(default=None, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    notes: str | None = Field(default=None, max_length=5000)


class VaccinationData(BaseModel):
    vaccine_name: str = Field(min_length=1, max_length=200)
    manufacturer: str | None = Field(default=None, max_length=200)
    lot_number: str | None = Field(default=None, max_length=100)
    site: str | None = Field(default=None, max_length=100)
    administered_by: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    next_dose: date | None = None


class LabResultValue(BaseModel):
    parameter: str = Field(min_length=1, max_length=200)
    value: str = Field(min_length=1, max_length=200)
    unit: str | None = Field(default=None, max_length=50)
    reference_range: str | None = Field(default=None, max_length=100)
    status: str | None = Field(default=None, max_length=50)


class LabResultData(BaseModel):
    test_name: str = Field(min_length=1, max_length=200)
    ordering_physician: str | None = Field(default=None, max_length=200)
    lab_name: str | None = Field(default=None, max_length=200)
    results: list[LabResultValue] = Field(default_factory=list)


class ConditionData(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    icd10_code: str | None = Field(default=None, max_length=20)
    diagnosed_date: date | None = None
    diagnosed_by: str | None = Field(default=None, max_length=200)
    status: str | None = Field(default=None, max_length=50)
    severity: str | None = Field(default=None, max_length=50)
    notes: str | None = Field(default=None, max_length=5000)


class AllergyData(BaseModel):
    allergen: str = Field(min_length=1, max_length=200)
    reaction: str | None = Field(default=None, max_length=200)
    severity: str | None = Field(default=None, max_length=50)
    first_occurrence: date | None = None
    verified_by: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=5000)


def validate_record_data(record_type: RecordType, data: dict[str, Any]) -> dict[str, Any]:
    # Validate and normalize; return JSON-serializable data.
    model: type[BaseModel]
    if record_type == "medication":
        model = MedicationData
    elif record_type == "vaccination":
        model = VaccinationData
    elif record_type == "lab_result":
        model = LabResultData
    elif record_type == "condition":
        model = ConditionData
    else:
        model = AllergyData

    try:
        parsed = model.model_validate(data)
    except ValidationError as e:
        # Bubble up a clean error payload for FastAPI
        raise e

    return parsed.model_dump(mode="json", exclude_none=True)

