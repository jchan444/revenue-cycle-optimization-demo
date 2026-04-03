from typing import Any

from fastapi import APIRouter, Body

from app.services.validator import validate_claim_data

router = APIRouter()

@router.post("/validate")
def validate_claim(claim: Any = Body(...)):
    return validate_claim_data(claim)
