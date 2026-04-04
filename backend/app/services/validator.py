from typing import Any, Dict, List, Union

import re

FHIR_CONDITION_REQUIRED_PATHS = (
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
)

def validate_claim_data(claim: Union[List[Dict[str, Any]], Dict[str, Any]]) -> Dict[str, Any]:
    errors: List[str] = []
    warnings: List[str] = []

    if isinstance(claim, list):
        for index, condition in enumerate(claim):
            for path in FHIR_CONDITION_REQUIRED_PATHS:
                if not has_nested_path(condition, path):
                    errors.append(f"Condition[{index}] - Missing or empty field: {path}")
    elif isinstance(claim, dict):
        required = ["patient_id", "procedure_code", "insurance_id", "amount"]
        for field in required:
            if not claim.get(field) and claim.get(field) != 0:
                errors.append(f"Missing or empty field: {field}")

        if "amount" in claim:
            try:
                amt = float(claim["amount"])
                if amt < 0:
                    errors.append("Amount must be non-negative")
            except (TypeError, ValueError):
                errors.append("Amount must be a number")

        proc = claim.get("procedure_code")
        if proc and not re.match(r"^[A-Za-z0-9]{3,7}$", str(proc)):
            warnings.append("Procedure code format unusual (expected 3-7 alphanumeric characters)")

        if "payload" in claim and claim["payload"] is not None and not isinstance(claim["payload"], dict):
            warnings.append("Payload should be a JSON object/dict if provided")
    else:
        errors.append("Unsupported claim payload type (expected list or dict)")

    return {"valid": not errors, "errors": errors, "warnings": warnings}


def has_nested_path(data: Dict[str, Any], path: str) -> bool:
    keys = path.split(".")
    for key in keys:
        if isinstance(data, dict) and key in data:
            data = data[key]
        elif isinstance(data, list) and key.isdigit():
            idx = int(key)
            data = data[idx] if idx < len(data) else None
        else:
            return False

    return data not in (None, "", [], {})
