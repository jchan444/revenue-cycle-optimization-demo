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

export interface FraudPrediction {
  fraud_risk: "Low" | "Average" | "High" | string;
  risk_score: number;
  warnings: string[];
}

export interface FraudDetectionResponse {
  denial_risk: "Low" | "Average" | "High" | string;
  denial_rate: number;
  global_denial_rate: number;
  matched_claims: number;
  total_claims: number;
  mode: string;
}

export interface ClaimDraftValues {
  id: string;
  patientId: string;
  providerId: string;
  procedureCode: string;
  insuranceId: string;
  diagnosisCode: string;
  amount: string;
  status: ClaimStatus;
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

export const getClaimProviderId = (claim: Claim): string =>
  getReferenceId(claim.provider?.reference) || claim.provider?.display || "";

export const getClaimProcedureLabel = (claim: Claim): string => {
  const firstItem = claim.item?.[0];

  return getCodingLabel(firstItem?.productOrService) || "Unknown procedure";
};

export const getClaimProcedureCode = (claim: Claim): string =>
  claim.item?.[0]?.productOrService?.coding?.[0]?.code ||
  claim.item?.[0]?.productOrService?.text ||
  "";

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

export const getClaimInsuranceId = (claim: Claim): string =>
  getReferenceId(claim.insurance?.[0]?.coverage?.reference) ||
  claim.insurance?.[0]?.coverage?.display ||
  "";

export const getClaimDiagnosisCode = (claim: Claim): string =>
  claim.diagnosis?.[0]?.diagnosisCodeableConcept?.text ||
  claim.diagnosis?.[0]?.diagnosisCodeableConcept?.coding?.[0]?.code ||
  getReferenceId(claim.diagnosis?.[0]?.diagnosisReference?.reference) ||
  claim.diagnosis?.[0]?.diagnosisReference?.display ||
  "";

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

const buildReference = (
  resourceType: string,
  id: string,
  fallbackDisplay?: string
): ReferenceValue | undefined => {
  const value = id.trim();
  if (!value && !fallbackDisplay) {
    return undefined;
  }

  return {
    reference: value ? `${resourceType}/${value}` : undefined,
    display: fallbackDisplay || value || undefined,
  };
};

export const claimToDraftValues = (claim?: Claim): ClaimDraftValues => ({
  id: claim?.id ?? "",
  patientId: claim ? getClaimPatientId(claim) || getClaimPatientLabel(claim) : "",
  providerId: claim ? getClaimProviderId(claim) : "",
  procedureCode: claim ? getClaimProcedureCode(claim) : "",
  insuranceId: claim ? getClaimInsuranceId(claim) : "",
  diagnosisCode: claim ? getClaimDiagnosisCode(claim) : "",
  amount: claim ? String(getClaimAmount(claim) || "") : "",
  status: (claim?.status?.trim()
    ? CLAIM_STATUS_LABELS[claim.status.trim().toLowerCase()] ?? claim.status
    : "Active") as ClaimStatus,
});

export const buildClaimFromDraft = (
  values: ClaimDraftValues,
  existingClaim?: Claim
): Claim => {
  const amount = Number(values.amount);
  const normalizedAmount = Number.isFinite(amount) ? amount : 0;
  const existingItem = existingClaim?.item?.[0];
  const existingDiagnosis = existingClaim?.diagnosis?.[0];
  const existingInsurance = existingClaim?.insurance?.[0];

  return {
    ...existingClaim,
    id: values.id.trim(),
    status: values.status,
    created: existingClaim?.created ?? new Date().toISOString(),
    patient: buildReference("Patient", values.patientId, values.patientId),
    provider: buildReference("Practitioner", values.providerId, values.providerId),
    diagnosis: values.diagnosisCode.trim()
      ? [
          {
            ...existingDiagnosis,
            sequence: existingDiagnosis?.sequence ?? 1,
            diagnosisCodeableConcept: {
              ...existingDiagnosis?.diagnosisCodeableConcept,
              text: values.diagnosisCode.trim(),
              coding: [
                {
                  ...existingDiagnosis?.diagnosisCodeableConcept?.coding?.[0],
                  code: values.diagnosisCode.trim(),
                  display: values.diagnosisCode.trim(),
                },
              ],
            },
          },
          ...(existingClaim?.diagnosis?.slice(1) ?? []),
        ]
      : [],
    insurance: [
      {
        ...existingInsurance,
        sequence: existingInsurance?.sequence ?? 1,
        focal: existingInsurance?.focal ?? true,
        coverage: buildReference("Coverage", values.insuranceId, values.insuranceId),
      },
      ...(existingClaim?.insurance?.slice(1) ?? []),
    ],
    item: [
      {
        ...existingItem,
        sequence: existingItem?.sequence ?? 1,
        productOrService: {
          ...existingItem?.productOrService,
          text: values.procedureCode.trim(),
          coding: [
            {
              ...existingItem?.productOrService?.coding?.[0],
              code: values.procedureCode.trim(),
              display: values.procedureCode.trim(),
            },
          ],
        },
        net: {
          ...existingItem?.net,
          value: normalizedAmount,
          currency: existingItem?.net?.currency ?? existingClaim?.total?.currency ?? "USD",
        },
      },
      ...(existingClaim?.item?.slice(1) ?? []),
    ],
    total: {
      ...existingClaim?.total,
      value: normalizedAmount,
      currency: existingClaim?.total?.currency ?? existingItem?.net?.currency ?? "USD",
    },
  };
};
