import {
  Claim,
  ValidationResponse,
  PatientSummary,
  OptimizeRequest,
} from "../types/claim";

const MOCK_DELAY_MS = 250;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const MOCK_CLAIMS: Claim[] = [
  {
    id: "CLM-1001",
    patient: "PT-2001",
    procedure: "99213",
    amount: 245.18,
    payerRuleStatus: "aligned",
    payerRuleMessage: "Diagnosis and procedure pair passes payer rule.",
  },
  {
    id: "CLM-1002",
    patient: "PT-2002",
    procedure: "70553",
    amount: 1349.5,
    payerRuleStatus: "violated",
    payerRuleMessage: "Prior authorization missing for advanced imaging.",
  },
  {
    id: "CLM-1003",
    patient: "PT-2003",
    procedure: "93000",
    amount: 185.0,
    payerRuleStatus: "aligned",
    payerRuleMessage: "Documentation supports billed procedure.",
  },
];

const MOCK_PATIENTS: Record<string, PatientSummary> = {
  "PT-2001": {
    id: "PT-2001",
    name: "Avery Brooks",
    age: 56,
    gender: "female",
    primaryCondition: "Type 2 diabetes mellitus",
  },
  "PT-2002": {
    id: "PT-2002",
    name: "Jordan Ramirez",
    age: 41,
    gender: "male",
    primaryCondition: "Chronic migraine",
  },
  "PT-2003": {
    id: "PT-2003",
    name: "Morgan Lee",
    age: 67,
    gender: "female",
    primaryCondition: "Essential hypertension",
  },
};

export const fetchClaims = async (): Promise<Claim[]> => {
  await sleep(MOCK_DELAY_MS);
  return MOCK_CLAIMS;
};

export const fetchPatient = async (id: string): Promise<PatientSummary> => {
  await sleep(MOCK_DELAY_MS);
  return (
    MOCK_PATIENTS[id] ?? {
      id,
      name: "Unknown Patient",
      age: 0,
      gender: "unknown",
      primaryCondition: "Not provided",
    }
  );
};

export const optimizeClaims = async (
  payload: OptimizeRequest
): Promise<ValidationResponse[]> => {
  await sleep(MOCK_DELAY_MS);
  return payload.claimIds.map((claimId) => {
    const claim = MOCK_CLAIMS.find((item) => item.id === claimId);
    const isViolation = claim?.payerRuleStatus === "violated";
    return {
      claimId,
      status: isViolation ? "invalid" : "valid",
      coverageStatus: isViolation ? "not_covered" : "covered",
      errors: isViolation
        ? [claim?.payerRuleMessage ?? "Payer rule validation failed"]
        : [],
    };
  });
};

export const validateClaim = async (
  claim: Claim
): Promise<ValidationResponse> => {
  await sleep(MOCK_DELAY_MS);
  const isViolation = claim.payerRuleStatus === "violated";
  return {
    claimId: claim.id,
    status: isViolation ? "invalid" : "valid",
    coverageStatus: isViolation ? "not_covered" : "covered",
    errors: isViolation
      ? [claim.payerRuleMessage ?? "Payer rule validation failed"]
      : [],
  };
};
