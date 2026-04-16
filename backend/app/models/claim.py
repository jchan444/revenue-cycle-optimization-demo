import json
from pathlib import Path
from typing import Any, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import uuid

router = APIRouter(prefix="/claims", tags=["claims"])
CLAIM_STATUS_OPTIONS = {
    "Active",
    "Review",
    "Cancelled",
    "Denied",
    "Approved",
    "Resubmit",
    "InProcess",
    "Submitted",
}

CLAIM_STATUS_ALIASES = {
    "active": "Active",
    "review": "Review",
    "cancelled": "Cancelled",
    "canceled": "Cancelled",
    "denied": "Denied",
    "approved": "Approved",
    "resubmit": "Resubmit",
    "inprocess": "InProcess",
    "submitted": "Submitted",
    "pending": "Active",
}


class Claim(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    provider_id: Optional[str] = None  # Sai added Provide id
    procedure_code: str
    insurance_id: str
    diagnosis_code: Optional[str] = None
    amount: float
    status: Optional[str] = "Active"
    payload: Optional[dict] = None


class ClaimStatusUpdate(BaseModel):
    status: str


def _data_file_path() -> Path:
    return Path(__file__).resolve().parents[3] / "data" / "FHIR_data" / "Claim.json"


def _extract_reference_id(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return value.split("/")[-1]


def _extract_procedure_code(resource: dict[str, Any]) -> str:
    items = resource.get("item") or []
    if not items:
        return ""

    product = items[0].get("productOrService") or {}
    coding = product.get("coding") or []
    primary_code = coding[0] if coding else {}

    return (
        product.get("text")
        or primary_code.get("display")
        or primary_code.get("code")
        or ""
    )


def _extract_amount(resource: dict[str, Any]) -> float:
    total = resource.get("total") or {}
    if isinstance(total.get("value"), (int, float)):
        return float(total["value"])

    item_total = 0.0
    for item in resource.get("item") or []:
        net = item.get("net") or {}
        if isinstance(net.get("value"), (int, float)):
            item_total += float(net["value"])
    return item_total


def _fhir_claim_to_claim_payload(resource: dict[str, Any]) -> dict[str, Any]:
    patient = resource.get("patient") or {}
    insurance = (resource.get("insurance") or [{}])[0]
    coverage = insurance.get("coverage") or {}

    return {
        "id": resource.get("id") or str(uuid.uuid4()),
        "patient_id": _extract_reference_id(patient.get("reference")),
        "provider_id": _extract_reference_id(  # Sai added  3 lines for Provide id
            (resource.get("provider") or {}).get("reference", "")
        ),
        "procedure_code": _extract_procedure_code(resource),
        "insurance_id": (
            _extract_reference_id(coverage.get("reference"))
            or coverage.get("display")
            or ""
        ),
        "diagnosis_code": (
            _extract_reference_id(
                ((resource.get("diagnosis") or [{}])[0].get("diagnosisReference") or {}).get("reference")
            )
        ),
        "amount": _extract_amount(resource),
        "status": normalize_claim_status(resource.get("status")),
        "payload": resource,
    }


def normalize_claim_status(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        return "Active"

    normalized = CLAIM_STATUS_ALIASES.get(value.strip().lower())
    if normalized:
        return normalized

    return value.strip()


def _load_claim_store() -> dict[str, "Claim"]:
    file_path = _data_file_path()
    if not file_path.exists():
        return {}

    with file_path.open("r", encoding="utf-8") as source:
        raw_claims = json.load(source)

    claim_store: dict[str, Claim] = {}
    for resource in raw_claims:
        claim = Claim(**_fhir_claim_to_claim_payload(resource))
        claim_store[claim.id] = claim
    return claim_store


_claim_store: dict[str, Claim] = _load_claim_store()


@router.get("/", response_model=List[Claim])
def list_claims():
    return list(_claim_store.values())


@router.get("/{claim_id}", response_model=Claim)
def get_claim(claim_id: str):
    claim = _claim_store.get(claim_id)
    if not claim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    return claim

@router.post("/", response_model=Claim, status_code=status.HTTP_201_CREATED)
def create_claim(claim: Claim):
    if claim.id in _claim_store:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Claim ID already exists")
    claim.status = normalize_claim_status(claim.status)
    if claim.payload is not None:
        claim.payload["status"] = claim.status
    _claim_store[claim.id] = claim
    return claim


@router.put("/{claim_id}", response_model=Claim)
def update_claim(claim_id: str, updated: Claim):
    existing = _claim_store.get(claim_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    updated.id = claim_id
    updated.status = normalize_claim_status(updated.status)
    if updated.payload is not None:
        updated.payload["status"] = updated.status
    _claim_store[claim_id] = updated
    return updated


@router.patch("/{claim_id}/status", response_model=Claim)
def update_claim_status(claim_id: str, update: ClaimStatusUpdate):
    claim = _claim_store.get(claim_id)
    if not claim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")

    normalized_status = normalize_claim_status(update.status)
    if normalized_status not in CLAIM_STATUS_OPTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid claim status",
        )

    claim.status = normalized_status
    if claim.payload is not None:
        claim.payload["status"] = normalized_status
    _claim_store[claim_id] = claim
    return claim


@router.delete("/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_claim(claim_id: str):
    if claim_id not in _claim_store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    del _claim_store[claim_id]
    return

