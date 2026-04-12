"""
Fraud Detection Service — Task 2
Detects provider-level, procedure-level, or combined anomalies and returns
a claim denial risk level: "Low", "Average", or "High".

Accepts the existing Claim model objects directly.

Claim.status values in the dataset:
  active (60%), approved (30%), cancelled (2%), denied (8%)

Denial rate = denied claims in subset / total claims in subset.
Risk is computed by comparing the subset denial rate against the global
denial rate within 5 percentage-points.
"""

from typing import TYPE_CHECKING, List

if TYPE_CHECKING:
    from app.models.claim import Claim


def _is_denied(claim: "Claim") -> bool:
    """Return True if the claim status is 'denied'.

    Updated claim.json data file now the status filed contains active, denied, approved, and cancelled values.
    """
    return (claim.status or "").lower() == "denied"


def _compute_risk(denial_rate: float, global_denial_rate: float) -> str:
    """
    Return denial risk level relative to the global average denial rate.

    Rules (+ or - 5 percentage-point threshold):
    Within + or - 5 pp of global_denial_rate      → "Average"
    More than 5 pp below global_denial_rate → "Low"
    More than 5 pp above global_denial_rate → "High"
    """
    risk_level_delta = denial_rate - global_denial_rate
    if abs(risk_level_delta) <= 0.05:
        return "Average"
    return "High" if risk_level_delta > 0 else "Low"


def detect_fraud(
    claims: List["Claim"],
    provider_id: str = None,
    procedure_code: str = None,
) -> dict:
    """
    Detect anomalies at provider level, procedure level, or both.

    Parameters
    ----------
    claims         : list of Claim model objects from _claim_store
    provider_id    : filter by Claim.provider_id; None to ignore
    procedure_code : filter by Claim.procedure_code; None to ignore

    Returns
    -------
    dict with keys:
        denial_risk    – "Low" or "Average" or "High"
        denial_rate    – float, denial rate of the subset claims
        global_denial_rate     – float, global denial rate across all claims
        matched_claims – int, number of claims in the subset
        total_claims   – int, total claims in the input
        mode           – "provider" or "procedure" or "provider_and_procedure"
    """
    if not claims:
        raise ValueError("claims list must not be empty")

    if provider_id is None and procedure_code is None:
        raise ValueError(
            "At least one of provider_id or procedure_code must be supplied"
        )

    # Global denial rate across ALL claims
    global_denial_rate = sum(1 for claim in claims if _is_denied(claim)) / len(claims)

    # Route to the correct detection method
    if provider_id and not procedure_code:
        denial_risk, denial_rate, matched_claims = _detect_provider_anomalies(claims, provider_id, global_denial_rate)
        detection_mode = "provider"

    elif procedure_code and not provider_id:
        denial_risk, denial_rate, matched_claims = _detect_procedure_anomalies(claims, procedure_code, global_denial_rate)
        detection_mode = "procedure"

    else:  # both supplied
        denial_risk, denial_rate, matched_claims = _detect_provider_and_procedure_anomalies(
            claims, provider_id, procedure_code, global_denial_rate
        )
        detection_mode = "provider_and_procedure"

    return {
        "denial_risk": denial_risk,
        "denial_rate": round(denial_rate, 4),
        "global_denial_rate": round(global_denial_rate, 4),
        "matched_claims": matched_claims,
        "total_claims": len(claims),
        "mode": detection_mode,
    }


def _detect_provider_anomalies(
    claims: List["Claim"],
    provider_id: str,
    global_denial_rate: float,
) -> tuple[str, float, int]:
    """
    Calculate the denial rate for a specific provider and compare it against
    the global average to determine the risk level.
    """
    subset_claims = [claim for claim in claims if claim.provider_id == provider_id]
    if not subset_claims:
        return "Average", 0.0, 0
    denial_rate = sum(1 for claim in subset_claims if _is_denied(claim)) / len(subset_claims)
    return _compute_risk(denial_rate, global_denial_rate), denial_rate, len(subset_claims)


def _detect_procedure_anomalies(
    claims: List["Claim"],
    procedure_code: str,
    global_denial_rate: float,
) -> tuple[str, float, int]:
    """
    Calculate the denial rate for a specific procedure code and compare it
    against the global average to determine risk level.
    
    """
    subset_claims = [claim for claim in claims if claim.procedure_code == procedure_code]
    if not subset_claims:
        return "Average", 0.0, 0    # Default to average
    denial_rate = sum(1 for claim in subset_claims if _is_denied(claim)) / len(subset_claims)
    return _compute_risk(denial_rate, global_denial_rate), denial_rate, len(subset_claims)


def _detect_provider_and_procedure_anomalies(
    claims: List["Claim"],
    provider_id: str,
    procedure_code: str,
    global_denial_rate: float,
) -> tuple[str, float, int]:
    """
    Calculate the denial rate for the intersection of a specific provider AND
    procedure code, then compare against the global average.
    
    """
    subset_claims = [
        claim for claim in claims
        if claim.provider_id == provider_id and claim.procedure_code == procedure_code
    ]
    if not subset_claims:
        return "Average", 0.0, 0    # Default to average
    denial_rate = sum(1 for claim in subset_claims if _is_denied(claim)) / len(subset_claims)
    return _compute_risk(denial_rate, global_denial_rate), denial_rate, len(subset_claims)
