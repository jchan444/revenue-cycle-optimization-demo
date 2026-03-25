import axios, { AxiosError } from "axios";
// import { Claim, ValidationResponse } from "../types/claim";

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
        axiosError.response.data?.message || "Backend server error occurred"
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

//reformat claim data if needed?
const formatClaim = (data: any): Claim => {
  let id;
  if (data.id !== undefined && data.id !== null) {
    id = data.id;
  } else {
    id = data.claim_id;
  }

  let patient;
  if (data.patient !== undefined && data.patient !== null) {
    patient = data.patient;
  } else {
    patient = data.patient_name;
  }

  return {
    id: id,
    patient: patient,
    amount: data.amount,
    procedure: data.procedure,
  };
};

//GET claims
export const fetchClaims = async (): Promise<Claim[]> => {
  try {
    const response = await API.get("/claims");

    return response.data.map((c: any) => formatClaim(c));
  } catch (error) {
    handleError(error);
  }
};

//POST request - validate
export const validateClaim = async (
  claimId: string
): Promise<ValidationResponse> => {
  try {
    const response = await API.post("/validate", { id: claimId });

    const data = response.data;

    let claimIdResult;

    if (data.claimId !== undefined && data.claimId !== null) {
      claimIdResult = data.claimId;
    } else {
      claimIdResult = data.id;
    }

    let coverageStatus;
    if (data.coverageStatus !== undefined && data.coverageStatus !== null) {
      coverageStatus = data.coverageStatus;
    } else {
      coverageStatus = data.coverage;
    }

    let errors;

    if (data.errors !== undefined && data.errors !== null) {
      errors = data.errors;
    } else {
      errors = [];
    }

    //placeholder for data for now
    return {
      claimId: claimIdResult,
      status: data.status,
      coverageStatus: coverageStatus,
      errors: errors,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};