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

export const CLAIM_STATUS_OPTIONS = [
  "Active",
  "Review",
  "Cancelled",
  "Denied",
  "Approved",
  "Resubmit",
  "InProcess",
  "Submitted",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUS_OPTIONS)[number];

export interface Claim {
  resourceType?: string;
  id: string;
  status?: ClaimStatus | string;
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
  claimStatus?: ClaimStatus;
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

export interface ValidationRequest {
  claimIds: string[];
}

const CLAIM_STATUS_LABELS: Record<string, ClaimStatus> = {
  active: "Active",
  review: "Review",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  denied: "Denied",
  approved: "Approved",
  resubmit: "Resubmit",
  inprocess: "InProcess",
  submitted: "Submitted",
  pending: "Active",
};

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

export const getClaimStatusLabel = (claim: Claim): string =>
  claim.status?.trim()
    ? CLAIM_STATUS_LABELS[claim.status.trim().toLowerCase()] ?? claim.status
    : "Unknown";

export const canClaimBeSelectedForValidation = (claim: Claim): boolean => {
  const status = getClaimStatusLabel(claim);
  return status === "Active" || status === "Resubmit";
};

export const getClaimDateLabel = (claim: Claim): string => {
  const rawDate = claim.created || claim.billablePeriod?.start || claim.billablePeriod?.end;
  if (!rawDate) {
    return "Unknown";
  }

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return rawDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(parsed);
};
