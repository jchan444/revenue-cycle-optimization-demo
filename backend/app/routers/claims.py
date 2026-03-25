from fastapi import APIRouter, Body
from app.services.validator import validate_claim_data

router = APIRouter(
)

@router.get("/")
def get_claims():
    return {"claims": []}


@router.post("/validate")
def validate_claim(claim: dict = Body(...)):
    validation_result = validate_claim_data(claim)
    return validation_result