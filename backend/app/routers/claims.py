from fastapi import APIRouter
from app.models.claim import Claim
from app.services.validator import validate_claim_data

router = APIRouter(
)

@router.get("/")
def get_claims():
    return {"claims": []}


@router.post("/validate")
def validate_claim(claim: Claim):
    return {
    }