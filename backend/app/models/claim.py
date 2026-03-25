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

# In-memory store for demo/testing
_claim_store: dict = {}

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
    _claim_store[claim.id] = claim
    return claim

@router.put("/{claim_id}", response_model=Claim)
def update_claim(claim_id: str, updated: Claim):
    existing = _claim_store.get(claim_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    updated.id = claim_id
    _claim_store[claim_id] = updated
    return updated

@router.delete("/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_claim(claim_id: str):
    if claim_id not in _claim_store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    del _claim_store[claim_id]
    return

