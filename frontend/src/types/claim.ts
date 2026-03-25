export interface Claim {
  id: string;
  patient: string;
  procedure: string;
  amount: number;
}

export interface ValidationResponse {
  claimId: string;
  status: "valid" | "invalid";
  coverageStatus: "covered" | "not_covered";
  errors: string[];
}

export interface BackendClaim {
  id: string;
  patient_id: string;
  procedure_code: string;
  insurance_id: string;
  amount: number;
}