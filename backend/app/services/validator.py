from typing import Any, Dict, List, Union

import re
import json
from pathlib import Path

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


def _load_condition_patient_ids() -> set[str]:
    condition_file = Path(__file__).resolve().parents[3] / "data" / "FHIR_data" / "Condition.json"
    patient_ids = set()

    if not condition_file.exists():
        return patient_ids

    try:
        with condition_file.open("r", encoding="utf-8") as source:
            conditions = json.load(source)

        for condition in conditions:
            subject = condition.get("subject", {})
            patient_ref = subject.get("reference", "")
            if patient_ref.startswith("Patient/"):
                patient_id = patient_ref.split("/", 1)[1]
                patient_ids.add(patient_id)
    except (json.JSONDecodeError, IOError):
        pass 

    return patient_ids


_CONDITION_PATIENT_IDS = _load_condition_patient_ids()


def _extract_reference_id(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return value.split("/")[-1]


def _is_fhir_claim(data: Dict[str, Any]) -> bool:
    return data.get("resourceType") == "Claim"

def _extract_from_fhir_claim(resource: Dict[str, Any]) -> Dict[str, Any]:
    patient = resource.get("patient") or {}
    insurance = (resource.get("insurance") or [{}])[0]
    coverage = insurance.get("coverage") or {}

    procedure_code = ""
    items = resource.get("item") or []
    if items and items[0].get("productOrService"):
        procedure_code = items[0]["productOrService"].get("text", "")

    return {
        "id": resource.get("id") or "",
        "patient_id": _extract_reference_id(patient.get("reference", "")),
        "provider_id": _extract_reference_id(
            (resource.get("provider") or {}).get("reference", "")
        ),
        "procedure_code": procedure_code,
        "insurance_id": (
            _extract_reference_id(coverage.get("reference"))
            or coverage.get("display")
            or ""
        ),
        "amount": resource.get("total", {}).get("value", 0),
        "status": resource.get("status") or "pending",
        "payload": resource,
    }


def validate_claim_data(claim: Union[List[Dict[str, Any]], Dict[str, Any]]) -> Dict[str, Any]:
    errors: List[str] = []
    warnings: List[str] = []

    if isinstance(claim, list):
        all_errors = []
        all_warnings = []
        for index, item in enumerate(claim):
            if isinstance(item, dict) and _is_fhir_claim(item):
                # It's a FHIR Claim - extract and validate
                extracted = _extract_from_fhir_claim(item)
                result = _validate_extracted_claim(extracted)
                if result["errors"]:
                    all_errors.extend([f"Claim[{index}]: {err}" for err in result["errors"]])
                all_warnings.extend([f"Claim[{index}]: {warn}" for warn in result["warnings"]])
            else:
                for path in FHIR_CONDITION_REQUIRED_PATHS:
                    if not has_nested_path(item, path):
                        all_errors.append(f"Condition[{index}] - Missing or empty field: {path}")
        errors.extend(all_errors)
        warnings.extend(all_warnings)

    elif isinstance(claim, dict):
        if _is_fhir_claim(claim):
            extracted = _extract_from_fhir_claim(claim)
            result = _validate_extracted_claim(extracted)
            errors.extend(result["errors"])
            warnings.extend(result["warnings"])
        else:
            result = _validate_extracted_claim(claim)
            errors.extend(result["errors"])
            warnings.extend(result["warnings"])
    else:
        errors.append("Unsupported claim payload type (expected list or dict)")

    return {"valid": not errors, "errors": errors, "warnings": warnings}


def _validate_extracted_claim(claim: Dict[str, Any]) -> Dict[str, Any]:
    errors: List[str] = []
    warnings: List[str] = []

    required = ["patient_id", "procedure_code", "insurance_id", "amount"]
    for field in required:
        if not claim.get(field) and claim.get(field) != 0:
            errors.append(f"Missing or empty field: {field}")

    patient_id = claim.get("patient_id")
    if patient_id and patient_id not in _CONDITION_PATIENT_IDS:
        errors.append(f"Patient ID '{patient_id}' not found in condition records")

    if "amount" in claim:
        try:
            amt = float(claim["amount"])
            if amt < 0:
                errors.append("Amount must be non-negative")
        except (TypeError, ValueError):
            errors.append("Amount must be a number")

    proc = claim.get("procedure_code")
    if proc and not re.match(r"^[A-Za-z0-9]{3,7}$|^[A-Za-z\s]{5,}$", str(proc)):
        pass 

    if "payload" in claim and claim["payload"] is not None and not isinstance(claim["payload"], dict):
        warnings.append("Payload should be a JSON object/dict if provided")

    return {"errors": errors, "warnings": warnings}


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
