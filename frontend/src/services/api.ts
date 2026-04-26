import axios, { AxiosError } from "axios";
import {
  Claim,
  ClaimStatus,
  ValidationResponse,
  BackendClaim,
  PatientSummary,
  ValidationRequest,
  FraudDetectionResponse,
  FraudPrediction,
  getClaimAmount,
  getClaimDiagnosisCode,
  getClaimInsuranceId,
  getClaimPatientId,
  getClaimProcedureCode,
  getClaimProviderId,
} from "../types/claim";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL as string,
  timeout: 5000,
});

const handleError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    const requestPath = axiosError.config?.url ?? "unknown endpoint";

    if (axiosError.response) {
      throw new Error(
        axiosError.response.data?.detail || "Backend server error occurred"
      );
    }

    if (axiosError.code === "ECONNABORTED") {
      throw new Error(`Backend request timed out after 5 seconds (${requestPath})`);
    }

    if (axiosError.request) {
      throw new Error(`No response from backend server (${requestPath}). Verify the API is running on http://localhost:8000.`);
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
    status: data.status ?? claim.status,
    payerRuleStatus: data.payer_rule_status,
    payerRuleMessage: data.payer_rule_message,
  };
};

const formatClaimForBackend = (claim: Claim) => {
  return {
    id: claim.id,
    patient_id: getClaimPatientId(claim) || claim.patient?.display || "",
    provider_id: getClaimProviderId(claim),
    procedure_code: getClaimProcedureCode(claim),
    insurance_id: getClaimInsuranceId(claim),
    diagnosis_code: getClaimDiagnosisCode(claim) || undefined,
    amount: getClaimAmount(claim),
    status: claim.status,
    payload: claim,
  };
};

export const fetchClaims = async (): Promise<Claim[]> => {
  try {
    const response = await API.get<BackendClaim[]>("/claims/");
    return response.data.map((data) => formatClaimForFrontend(data));
  } catch (error) {
    return handleError(error);
  }
};

export const createClaim = async (claim: Claim): Promise<Claim> => {
  try {
    const response = await API.post<BackendClaim>("/claims", formatClaimForBackend(claim));
    return formatClaimForFrontend(response.data);
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

export const predictFraud = async (claim: Claim): Promise<FraudPrediction> => {
  try {
    const response = await API.post<FraudPrediction>("/api/fraud/predict", { claim: formatClaimForBackend(claim) });
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

export const detectFraud = async (claim: Claim): Promise<FraudDetectionResponse> => {
  try {
    const response = await API.post<FraudDetectionResponse>("/api/fraud/detect", {
      provider_id: getClaimProviderId(claim) || undefined,
      procedure_code: getClaimProcedureCode(claim) || undefined,
    });
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

export const validateClaims = async (
  payload: ValidationRequest
): Promise<ValidationResponse[]> => {
  try {
    const response = await API.post("/api/validate", payload);
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

export const updateClaimStatus = async (
  claimId: string,
  status: ClaimStatus
): Promise<Claim> => {
  try {
    const response = await API.patch<BackendClaim>(`/claims/${claimId}/status`, { status });
    return formatClaimForFrontend(response.data);
  } catch (error) {
    return handleError(error);
  }
};

export const updateClaim = async (claimId: string, claim: Claim): Promise<Claim> => {
  try {
    const response = await API.put<BackendClaim>(`/claims/${claimId}`, formatClaimForBackend(claim));
    return formatClaimForFrontend(response.data);
  } catch (error) {
    return handleError(error);
  }
};

export const deleteClaim = async (claimId: string): Promise<void> => {
  try {
    await API.delete(`/claims/${claimId}`);
  } catch (error) {
    return handleError(error);
  }
};
