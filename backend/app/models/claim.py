from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import uuid

router = APIRouter(prefix="/claims", tags=["claims"])


class Claim(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    procedure_code: str
    insurance_id: str
    diagnosis_code: Optional[str] = None
    amount: float
    status: Optional[str] = "pending"
    payload: Optional[dict] = None

_claim_store: dict = {}

@router.get("/", response_model=List[Claim])
def list_claims():
    """Return all claims currently stored in memory."""
    return list(_claim_store.values())


@router.get("/{claim_id}", response_model=Claim)
def get_claim(claim_id: str):
    """Fetch a single claim by its ID, or raise 404 if missing."""
    claim = _claim_store.get(claim_id)
    if not claim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    return claim


def condition_to_claim_payload(condition: dict) -> dict:
    """Convert a FHIR Condition object into internal Claim fields."""
    patient_reference = condition.get("subject", {}).get("reference", "")
    encounter_reference = condition.get("encounter", {}).get("reference", "")
    procedure_coding = condition.get("code", {}).get("coding", [{}])[0]

    return {
        "patient_id": patient_reference.split("/")[-1] if patient_reference else "",
        "procedure_code": procedure_coding.get("code", ""),
        "insurance_id": encounter_reference.split("/")[-1] if encounter_reference else "",
        "diagnosis_code": condition.get("code", {}).get("text"),
        "amount": float(condition.get("amount", 0) or 0),
        "payload": condition,
    }


@router.post("/import-fhir", response_model=List[Claim], status_code=status.HTTP_201_CREATED)
def import_fhir_conditions(conditions: List[dict]):
    """Import FHIR Condition list to Claim model and store in memory."""
    created_claims: List[Claim] = []
    for condition in conditions:
        payload = condition_to_claim_payload(condition)
        claim = Claim(**payload)
        if claim.id in _claim_store:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Claim ID already exists: {claim.id}")
        _claim_store[claim.id] = claim
        created_claims.append(claim)
    return created_claims


@router.post("/", response_model=Claim, status_code=status.HTTP_201_CREATED)
def create_claim(claim: Claim):
    """Create a new claim and return it, enforcing unique ID."""
    if claim.id in _claim_store:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Claim ID already exists")
    _claim_store[claim.id] = claim
    return claim

