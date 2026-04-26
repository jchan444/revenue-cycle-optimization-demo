from typing import Dict, Any, Set

#can add to this list if needed
LOW_ACUITY_CONDITIONS = {
    "encounter for symptom",
    "general examination of patient (procedure)",
    "well child visit (procedure)",
    "encounter for check up (procedure)",
    "outpatient procedure",
}

CHRONIC_CONDITIONS = {
    "subcutaneous immunotherapy",
    "asthma follow-up",
    "hypertension follow-up encounter",
    "allergic disorder follow-up assessment",
    "perennial allergic rhinitis",
    "asthma",
}

HIGH_ACUITY_CONDITIONS = {
    "appendicitis",
    "rupture of appendix",
    "drug overdose",
    "concussion",
    "emergency room admission (procedure)",
    "obstetric emergency hospital admission",
}

PREVENTIVE_CARE = {
    "influenza, seasonal, injectable, preservative free",
    "hep b, adult",
    "td (adult) preservative free",
    "mmr",
    "varicella",
}

#combined both high acuity and chronic togethjer
HIGH_RISK_KEYWORDS: Set[str] = (
    HIGH_ACUITY_CONDITIONS | CHRONIC_CONDITIONS
)

#normalize phrases
def normalize(text: str) -> str:
    return (text or "").strip().lower()


def detect_predictive_fraud(claim: Dict[str, Any]) -> Dict[str, Any]:
    warnings = []
    risk_score = 0

    #grab needed data from claim
    procedure_code = normalize(claim.get("procedure_code"))
    diagnosis_code = normalize(claim.get("diagnosis_code"))
    amount = float(claim.get("amount", 0))

    #check for high acuity/chronic_condition words
    if any(keyword in procedure_code for keyword in HIGH_RISK_KEYWORDS):
        risk_score += 2
        warnings.append(
            f"Procedure '{procedure_code}' is associated with higher denial/fraud patterns."
        )

    #look for low acuity conditions paired with high priced claims
    if any(low in procedure_code for low in LOW_ACUITY_CONDITIONS) and amount > 2000:
        risk_score += 2
        warnings.append(
            "Low-acuity visit billed with unusually high amount."
        )

    #Look for preventative care paired with high prices
    if any(preventive in procedure_code for preventive in PREVENTIVE_CARE) and amount > 500:
        risk_score += 1
        warnings.append(
            "Preventive care procedure has unusually high billing amount."
        )

    #check for absence of diagnosis code
    if not diagnosis_code:
        risk_score += 1
        warnings.append(
            "Missing diagnosis code reduces clinical justification confidence."
        )

    #check for high acuity WITH missing diagnosis code
    if any(high in procedure_code for high in HIGH_ACUITY_CONDITIONS) and not diagnosis_code:
        risk_score += 2
        warnings.append(
            "High-acuity procedure missing diagnosis code."
        )

    #Compare risk score
    if risk_score <= 1:
        fraud_risk = "Low"
    elif risk_score == 2:
        fraud_risk = "Average"
    else:
        fraud_risk = "High"

    return {
        "fraud_risk": fraud_risk,
        "risk_score": risk_score,
        "procedure_code": procedure_code,
        "warnings": warnings
    }