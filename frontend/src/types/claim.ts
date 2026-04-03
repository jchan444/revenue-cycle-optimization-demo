export interface Coding {
  system?: string;
  code?: string;
  display?: string;
}

export interface CodeableConcept {
  text?: string;
  coding?: Coding[];
}

export interface ReferenceValue {
  reference?: string;
  display?: string;
}

export interface Money {
  value?: number;
  currency?: string;
}

export interface Claim {
  resourceType?: string;
  id: string;
  status?: string;
  created?: string;
  use?: string;
  type?: CodeableConcept;
  priority?: CodeableConcept;
  patient?: ReferenceValue;
  provider?: ReferenceValue;
  prescription?: ReferenceValue;
  billablePeriod?: {
    start?: string;
    end?: string;
  };
  diagnosis?: Array<{
    sequence?: number;
    diagnosisReference?: ReferenceValue;
    diagnosisCodeableConcept?: CodeableConcept;
  }>;
  procedure?: Array<{
    sequence?: number;
    procedureReference?: ReferenceValue;
    procedureCodeableConcept?: CodeableConcept;
  }>;
  supportingInfo?: Array<{
    sequence?: number;
    category?: CodeableConcept;
    valueReference?: ReferenceValue;
    code?: CodeableConcept;
  }>;
  insurance?: Array<{
    sequence?: number;
    focal?: boolean;
    coverage?: ReferenceValue;
  }>;
  item?: Array<{
    sequence?: number;
    diagnosisSequence?: number[];
    procedureSequence?: number[];
    informationSequence?: number[];
    encounter?: ReferenceValue[];
    productOrService?: CodeableConcept;
    net?: Money;
  }>;
  total?: Money;
  payerRuleStatus?: "aligned" | "violated";
  payerRuleMessage?: string;
}

export interface ValidationResponse {
  claimId: string;
  status: "valid" | "invalid";
  coverageStatus: "covered" | "not_covered";
  errors: string[];
}

export interface BackendClaim extends Claim {
  payload?: Claim;
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

const getReferenceId = (value?: string): string => {
  if (!value) {
    return "";
  }

  const segments = value.split("/");
  return segments[segments.length - 1] ?? "";
};

export const getCodingLabel = (concept?: CodeableConcept): string =>
  concept?.text ||
  concept?.coding?.[0]?.display ||
  concept?.coding?.[0]?.code ||
  "Unknown";

export const getClaimPatientLabel = (claim: Claim): string =>
  claim.patient?.display || getReferenceId(claim.patient?.reference) || "Unknown patient";

export const getClaimPatientId = (claim: Claim): string =>
  getReferenceId(claim.patient?.reference);

export const getClaimProcedureLabel = (claim: Claim): string => {
  const firstItem = claim.item?.[0];

  return getCodingLabel(firstItem?.productOrService) || "Unknown procedure";
};

export const getClaimAmount = (claim: Claim): number => {
  if (typeof claim.total?.value === "number") {
    return claim.total.value;
  }

  return claim.item?.reduce((sum, item) => sum + (item.net?.value ?? 0), 0) ?? 0;
};

export const getClaimPayerLabel = (claim: Claim): string =>
  claim.insurance?.[0]?.coverage?.display ||
  getReferenceId(claim.insurance?.[0]?.coverage?.reference) ||
  "Unknown payer";

export const getClaimTypeLabel = (claim: Claim): string =>
  getCodingLabel(claim.type);

export const getClaimPriorityLabel = (claim: Claim): string =>
  getCodingLabel(claim.priority);

export const getClaimServiceLineCount = (claim: Claim): number =>
  claim.item?.length ?? 0;

export const getClaimDiagnosisCount = (claim: Claim): number =>
  claim.diagnosis?.length ?? 0;

export const getClaimProcedureCount = (claim: Claim): number =>
  claim.procedure?.length ?? 0;
