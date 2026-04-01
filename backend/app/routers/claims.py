from typing import Any
from fastapi import APIRouter, Body, HTTPException, status
from app.services.validator import validate_claim_data

router = APIRouter(
)

@router.get("/")
def get_claims():
    return {"claims": []}


@router.post("/validate")
def validate_claim(claim: Any = Body(...)):
    # Accept either a JSON object (dict) or a JSON array (list) and pass through
    # to the validator which supports both shapes.
    validation_result = validate_claim_data(claim)
    if not validation_result.get("valid", False):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=validation_result)
    return validation_result