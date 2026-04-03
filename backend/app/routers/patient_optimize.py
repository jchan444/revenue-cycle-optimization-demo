from typing import Any, List

from fastapi import APIRouter
from pydantic import BaseModel

from app.models.claim import Claim, _claim_store
from app.services.validator import validate_claim_data

router = APIRouter(prefix="/api", tags=["api"])


class OptimizeRequest(BaseModel):
    claimIds: List[str]


def _claim_to_validation_payload(claim: Claim) -> dict[str, Any]:
    return {
        "patient_id": claim.patient_id,
        "procedure_code": claim.procedure_code,
        "insurance_id": claim.insurance_id,
        "amount": claim.amount,
    }


@router.get("/patient/{patient_id}")
def get_patient(patient_id: str):
    """Patient summary for the claim detail view. Replace with DB lookup when available."""
    for claim in _claim_store.values():
        if claim.patient_id == patient_id:
            return {
                "name": f"Patient {patient_id}",
                "age": 0,
                "gender": "unknown",
                "primaryCondition": "Not provided",
            }
    return {
        "name": "Unknown Patient",
        "age": 0,
        "gender": "unknown",
        "primaryCondition": "Not provided",
    }


@router.post("/optimize")
def optimize(req: OptimizeRequest) -> List[dict[str, Any]]:
    """Run validation rules for each selected claim id; shape matches the frontend `ValidationResponse`."""
    results: List[dict[str, Any]] = []
    for claim_id in req.claimIds:
        claim = _claim_store.get(claim_id)
        if not claim:
            results.append(
                {
                    "claimId": claim_id,
                    "status": "invalid",
                    "coverageStatus": "not_covered",
                    "errors": ["Claim not found"],
                }
            )
            continue
        vr = validate_claim_data(_claim_to_validation_payload(claim))
        if vr.get("valid"):
            results.append(
                {
                    "claimId": claim_id,
                    "status": "valid",
                    "coverageStatus": "covered",
                    "errors": [],
                }
            )
        else:
            results.append(
                {
                    "claimId": claim_id,
                    "status": "invalid",
                    "coverageStatus": "not_covered",
                    "errors": vr.get("errors") or [],
                }
            )
    return results
