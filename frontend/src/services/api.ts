import axios, { AxiosError } from "axios";
import {
  Claim,
  ValidationResponse,
  BackendClaim,
  PatientSummary,
  OptimizeRequest,
} from "../types/claim";

//axios instance
const API = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 5000,
});

//central error handler
const handleError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;

    if (axiosError.response) {
      //if the server responded with error
      throw new Error(
        axiosError.response.data?.detail || "Backend server error occurred"
      );
    } else if (axiosError.request) {
      //no response received from backend
      throw new Error("No response from backend server");
    } else {
      //axios config error
      throw new Error("Possible frontend Request setup error");
    }
  }

  //unknown error
  throw new Error("Unexpected error occurred");
};

//format to send to frontend - update if needed for FRONTEND
const formatClaimForFrontend = (data: BackendClaim): Claim => {
  return {
    id: data.id,
    patient: data.patient_id,
    amount: data.amount,
    procedure: data.procedure_code,
    payerRuleStatus: data.payer_rule_status,
    payerRuleMessage: data.payer_rule_message,
  };
};

//format frontend → backend
const formatClaimForBackend = (claim: Claim) => {
  return {
    id: claim.id,
    patient_id: claim.patient,
    procedure_code: claim.procedure,
    insurance_id: "placeholder", //placeholder
    amount: claim.amount,
  };
};

//GET claims
export const fetchClaims = async (): Promise<Claim[]> => {
  try {
    const response = await API.get("/api/claims");

    return response.data.map((data: any) => formatClaimForFrontend(data));
  } catch (error) {
    handleError(error);
    throw error;
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
    handleError(error);
    throw error;
  }
};

export const optimizeClaims = async (
  payload: OptimizeRequest
): Promise<ValidationResponse[]> => {
  try {
    const response = await API.post("/api/optimize", payload);
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
};

//POST request - validate
export const validateClaim = async (
  claim: Claim
): Promise<ValidationResponse> => {
  try {
    const payload = formatClaimForBackend(claim);

    const response = await API.post("/validate", payload);

    const data = response.data;

    //update if needed for BACKEND -> FRONTEND
    return {
      claimId: claim.id,
      status: data.valid ? "valid" : "invalid",
      coverageStatus: data.valid ? "covered" : "not_covered",
      errors: data.errors || [],
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};
