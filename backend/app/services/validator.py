from typing import Dict, Any
import re


def validate_claim_data(claim: Dict[str, Any]) -> Dict[str, Any]:
    """Validate a claim payload and return a structured result.

    Returns:
        {"valid": bool, "errors": List[str], "warnings": List[str]}
    """
    errors = []
    warnings = []

    # Required fields
    required = ["patient_id", "procedure_code", "insurance_id", "amount"]
    for field in required:
        if not claim.get(field) and claim.get(field) != 0:
            errors.append(f"Missing or empty field: {field}")

    # Amount must be a number and non-negative
    if "amount" in claim:
        try:
            amt = float(claim["amount"])
            if amt < 0:
                errors.append("Amount must be non-negative")
        except Exception:
            errors.append("Amount must be a number")

    # Procedure code simple format check (alphanumeric, 3-7 chars)
    proc = claim.get("procedure_code")
    if proc:
        if not re.match(r"^[A-Za-z0-9]{3,7}$", str(proc)):
            warnings.append("Procedure code format unusual (expected 3-7 alphanumeric characters)")

    # payload should be an object when present
    if "payload" in claim and claim["payload"] is not None and not isinstance(claim["payload"], dict):
        warnings.append("Payload should be a JSON object/dict if provided")

    valid = len(errors) == 0
    return {"valid": valid, "errors": errors, "warnings": warnings}