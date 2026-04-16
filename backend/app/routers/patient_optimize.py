from typing import Any, List

from fastapi import APIRouter, Body
from pydantic import BaseModel

from app.models.claim import Claim, _claim_store
from app.services.validator import validate_claim_data
from app.services.fraud_detection_based_on_history import detect_fraud      # Sai added

router = APIRouter(prefix="/api", tags=["api"])
VALIDATION_ELIGIBLE_STATUSES = {"Active", "Resubmit"}


class ValidationRequest(BaseModel):
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


@router.post("/validate")
def validate(req: ValidationRequest) -> List[dict[str, Any]]:
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
        if claim.status not in VALIDATION_ELIGIBLE_STATUSES:
            results.append(
                {
                    "claimId": claim_id,
                    "status": "invalid",
                    "coverageStatus": "not_covered",
                    "errors": [f"Claim status {claim.status} is not eligible for validation"],
                    "claimStatus": claim.status,
                }
            )
            continue

        claim.status = "InProcess"
        if claim.payload is not None:
            claim.payload["status"] = "InProcess"

        vr = validate_claim_data(_claim_to_validation_payload(claim))
        if vr.get("valid"):
            claim.status = "Submitted"
            if claim.payload is not None:
                claim.payload["status"] = "Submitted"
            results.append(
                {
                    "claimId": claim_id,
                    "status": "valid",
                    "coverageStatus": "covered",
                    "errors": [],
                    "claimStatus": claim.status,
                }
            )
        else:
            claim.status = "Review"
            if claim.payload is not None:
                claim.payload["status"] = "Review"
            results.append(
                {
                    "claimId": claim_id,
                    "status": "invalid",
                    "coverageStatus": "not_covered",
                    "errors": vr.get("errors") or [],
                    "claimStatus": claim.status,
                }
            )
    return results

# Sai code begins
class FraudDetectRequest(BaseModel):
    provider_id: str = None
    procedure_code: str = None
    claims: List[Claim] = None


class FraudDetectResponse(BaseModel):
    denial_risk: str
    denial_rate: float
    global_denial_rate: float
    matched_claims: int
    total_claims: int
    mode: str


@router.post("/fraud/detect", response_model=FraudDetectResponse)
def detect_fraud_endpoint(req: FraudDetectRequest) -> FraudDetectResponse:
    claims: List[Claim] = req.claims if req.claims else list(_claim_store.values())
    detected_results = detect_fraud(
        claims=claims,
        provider_id=req.provider_id or None,
        procedure_code=req.procedure_code or None,
    )
    return FraudDetectResponse(**detected_results)  # ** unpacks output variables
# Sai code ends
