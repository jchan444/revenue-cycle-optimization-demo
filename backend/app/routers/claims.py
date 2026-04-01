from typing import Any, List
from fastapi import APIRouter, Body, HTTPException, status
from app.models.claim import Claim, _claim_store
from app.services.validator import validate_claim_data

router = APIRouter()

@router.get("/claims", response_model=List[Claim])
def list_claims():
    """Return all stored claims from memory.
    This endpoint is used by the frontend to display a list of claims.
    """
    return list(_claim_store.values())


@router.get("/claims/{claim_id}", response_model=Claim)
def get_claim(claim_id: str):
    """Return a single claim by id.
    If the claim is not found, return HTTP 404.
    """
    claim = _claim_store.get(claim_id)
    if not claim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    return claim


@router.post("/validate")
def validate_claim(claim: Any = Body(...)):
    """Validate a claim payload.
    Accepts either a single dict or a list of dicts (e.g. FHIR Condition list).
    Returns 200 with validation details when valid or 400 with failures.
    """
    validation_result = validate_claim_data(claim)
    if not validation_result.get("valid", False):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=validation_result)
    return validation_result