import axios, { AxiosError } from "axios";
import {
  Claim,
  ValidationResponse,
  BackendClaim,
  PatientSummary,
  OptimizeRequest,
  getClaimAmount,
} from "../types/claim";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL as string,
  timeout: 5000,
});

const handleError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;

    if (axiosError.response) {
      throw new Error(
        axiosError.response.data?.detail || "Backend server error occurred"
      );
    }

    if (axiosError.request) {
      throw new Error("No response from backend server");
    }

    throw new Error("Possible frontend Request setup error");
  }

  throw new Error("Unexpected error occurred");
};

const formatClaimForFrontend = (data: BackendClaim): Claim => {
  const claim = data.payload ?? data;

  return {
    ...claim,
    id: claim.id,
    payerRuleStatus: data.payer_rule_status,
    payerRuleMessage: data.payer_rule_message,
  };
};

const formatClaimForBackend = (claim: Claim) => {
  return {
    id: claim.id,
    patient_id:
      claim.patient?.reference?.split("/").pop() ?? claim.patient?.display ?? "",
    procedure_code:
      claim.item?.[0]?.productOrService?.coding?.[0]?.code ??
      claim.item?.[0]?.productOrService?.text ??
      "",
    insurance_id:
      claim.insurance?.[0]?.coverage?.reference?.split("/").pop() ??
      claim.insurance?.[0]?.coverage?.display ??
      "",
    amount: getClaimAmount(claim),
  };
};

export const fetchClaims = async (): Promise<Claim[]> => {
  try {
    const response = await API.get<BackendClaim[]>("/claims");
    return response.data.map((data) => formatClaimForFrontend(data));
  } catch (error) {
    return handleError(error);
  }
};

export const validateClaim = async (
  claim: Claim
): Promise<ValidationResponse> => {
  try {
    const payload = formatClaimForBackend(claim);
    const response = await API.post("/validate", payload);
    const data = response.data;

    return {
      claimId: claim.id,
      status: data.valid ? "valid" : "invalid",
      coverageStatus: data.valid ? "covered" : "not_covered",
      errors: data.errors || [],
    };
  } catch (error) {
    return handleError(error);
  }
};

export const fetchPatient = async (id: string): Promise<PatientSummary> => {
  try {
    const response = await API.get(`/api/patient/${id}`);
    const data = response.data;
    return {
      id,
      name: data?.name ?? "Unknown Patient",
      age: data?.age ?? 0,
      gender: data?.gender ?? "unknown",
      primaryCondition: data?.primaryCondition ?? "Not provided",
    };
  } catch (error) {
    return handleError(error);
  }
};

export const optimizeClaims = async (
  payload: OptimizeRequest
): Promise<ValidationResponse[]> => {
  try {
    const response = await API.post("/api/optimize", payload);
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};
