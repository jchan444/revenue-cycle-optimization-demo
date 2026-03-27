export interface Claim {
  id: string;
  patient: string;
  procedure: string;
  amount: number;
  payerRuleStatus?: "aligned" | "violated";
  payerRuleMessage?: string;
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
  payer_rule_status?: "aligned" | "violated";
  payer_rule_message?: string;
}

export interface PatientSummary {
  id: string;
  name: string;
  age: number;
  gender: string;
  primaryCondition: string;
}

export interface OptimizeRequest {
  claimIds: string[];
}