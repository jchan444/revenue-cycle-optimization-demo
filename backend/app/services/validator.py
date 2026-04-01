from typing import Dict, Any, List, Union
import re


def validate_claim_data(claim: Union[List[Dict[str, Any]], Dict[str, Any]]) -> Dict[str, Any]:
    """Validate either a FHIR-like list of Condition resources or a flat claim dict.

    Returns a dict: {"valid": bool, "errors": List[str], "warnings": List[str]}.
    """
    errors: List[str] = []
    warnings: List[str] = []

    # If claim is a list we assume FHIR Condition-like objects
    if isinstance(claim, list):
        # Require deeper checks into coding arrays (check first coding entry code)
        required_paths = [
            "resourceType",
            "id",
            "clinicalStatus.coding.0.code",
            "verificationStatus.coding.0.code",
            "code.coding.0.code",
            "code.text",
            "subject.reference",
            "encounter.reference",
            "onsetDateTime",
            "recordedDate",
        ]

        for index, condition in enumerate(claim):
            for path in required_paths:
                if not has_nested_path(condition, path):
                    errors.append(f"Condition[{index}] - Missing or empty field: {path}")

    elif isinstance(claim, dict):
        # Flat claim format (legacy/demo). Check required flat fields.
        required = ["patient_id", "procedure_code", "insurance_id", "amount"]
        for field in required:
            if not claim.get(field) and claim.get(field) != 0:
                errors.append(f"Missing or empty field: {field}")

        # Amount checks
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
                warnings.append(
                    "Procedure code format unusual (expected 3-7 alphanumeric characters)"
                )

        # payload type warning
        if "payload" in claim and claim["payload"] is not None and not isinstance(claim["payload"], dict):
            warnings.append("Payload should be a JSON object/dict if provided")

    else:
        errors.append("Unsupported claim payload type (expected list or dict)")

    valid = len(errors) == 0
    return {"valid": valid, "errors": errors, "warnings": warnings}

def has_nested_path(data: Dict[str, Any], path: str) -> bool:
    keys = path.split('.')
    for key in keys:
        if isinstance(data, dict) and key in data:
            data = data[key]
        elif isinstance(data, list) and key.isdigit():
            # This allows checking "coding.0.code"
            idx = int(key)
            data = data[idx] if idx < len(data) else None
        else:
            return False
    
    # Comprehensive empty check
    if data in [None, "", [], {}]:
        return False
    return True