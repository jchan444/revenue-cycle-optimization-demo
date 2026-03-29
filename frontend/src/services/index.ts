import * as httpApi from "./api";
import * as mockApi from "./mock_api";

const useMockApi = process.env.REACT_APP_USE_MOCK_API === "true";

export const fetchClaims = useMockApi ? mockApi.fetchClaims : httpApi.fetchClaims;
export const fetchPatient = useMockApi
  ? mockApi.fetchPatient
  : httpApi.fetchPatient;
export const optimizeClaims = useMockApi
  ? mockApi.optimizeClaims
  : httpApi.optimizeClaims;
export const validateClaim = useMockApi
  ? mockApi.validateClaim
  : httpApi.validateClaim;
