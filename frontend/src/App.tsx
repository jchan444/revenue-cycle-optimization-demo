import React, { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import ClaimForm from "./components/ClaimForm";
import ClaimTable from "./components/ClaimTable";
import PatientSummaryCard from "./components/PatientSummaryCard";
import PayerRuleAlert from "./components/PayerRuleAlert";
import {
  createClaim,
  detectFraud,
  deleteClaim,
  fetchClaims,
  fetchPatient,
  predictFraud,
  updateClaim,
  updateClaimStatus,
  validateClaims,
} from "./services";
import {
  Claim,
  ClaimDraftValues,
  FraudDetectionResponse,
  FraudPrediction,
  PatientSummary,
  ValidationResponse,
  buildClaimFromDraft,
  canClaimBeSelectedForValidation,
  getClaimAmount,
  getClaimDiagnosisCount,
  getClaimPatientId,
  getClaimPatientLabel,
  getClaimPayerLabel,
  getClaimPriorityLabel,
  getClaimProcedureCount,
  getClaimProcedureCode,
  getClaimProcedureLabel,
  getClaimProviderId,
  getClaimServiceLineCount,
  getClaimStatusLabel,
  getClaimTypeLabel,
} from "./types/claim";

interface ClaimInsight {
  claim: Claim;
  score: number;
  lane: "Validation Ready" | "Needs Review";
  findings: string[];
  blockers: string[];
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatDate = (value?: string): string => {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return dateFormatter.format(parsed);
};

const formatPeriod = (claim: Claim): string => {
  const start = formatDate(claim.billablePeriod?.start);
  const end = formatDate(claim.billablePeriod?.end);

  if (start === "Unknown" && end === "Unknown") {
    return "No billable period";
  }

  return `${start} - ${end}`;
};

const isNoInsurance = (claim: Claim): boolean => {
  const payer = getClaimPayerLabel(claim).toUpperCase();
  return payer === "NO_INSURANCE" || payer === "UNKNOWN PAYER";
};

const buildClaimInsight = (claim: Claim): ClaimInsight => {
  const findings: string[] = [];
  const blockers: string[] = [];
  let score = 100;

  if (claim.payerRuleStatus === "violated") {
    blockers.push("Payer rule mismatch detected");
    score -= 30;
  } else if (claim.payerRuleStatus === "aligned") {
    findings.push("Payer rules aligned");
  } else {
    findings.push("Payer rules pending evaluation");
    score -= 6;
  }

  if (isNoInsurance(claim)) {
    blockers.push("Coverage requires self-pay or manual follow-up");
    score -= 28;
  } else {
    findings.push(`Primary payer: ${getClaimPayerLabel(claim)}`);
  }

  if (!getClaimDiagnosisCount(claim)) {
    blockers.push("No diagnosis linkage on claim");
    score -= 16;
  } else {
    findings.push(`${getClaimDiagnosisCount(claim)} diagnosis reference(s) attached`);
  }

  if (!getClaimServiceLineCount(claim)) {
    blockers.push("No service lines found");
    score -= 20;
  } else {
    findings.push(`${getClaimServiceLineCount(claim)} service line(s) mapped`);
  }

  if (!claim.provider?.display) {
    blockers.push("Missing provider display");
    score -= 8;
  }

  if (!claim.billablePeriod?.start || !claim.billablePeriod?.end) {
    blockers.push("Incomplete billable period");
    score -= 10;
  }

  const itemsWithoutCoding =
    claim.item?.filter(
      (item) =>
        !item.productOrService?.text &&
        !item.productOrService?.coding?.[0]?.display &&
        !item.productOrService?.coding?.[0]?.code
    ).length ?? 0;

  if (itemsWithoutCoding > 0) {
    blockers.push(`${itemsWithoutCoding} service line(s) missing code text`);
    score -= 12;
  }

  const itemsWithoutAmount =
    claim.item?.slice(1).filter((item) => typeof item.net?.value !== "number").length ?? 0;

  if (itemsWithoutAmount > 0) {
    findings.push(`${itemsWithoutAmount} line item(s) missing net amount`);
    score -= 6;
  }

  if (getClaimProcedureCount(claim)) {
    findings.push(`${getClaimProcedureCount(claim)} procedure reference(s) available`);
  }

  return {
    claim,
    score: Math.max(12, Math.min(100, score)),
    lane: blockers.length === 0 ? "Validation Ready" : "Needs Review",
    findings,
    blockers,
  };
};

function App() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [fraudPredictions, setFraudPredictions] = useState<Record<string, FraudPrediction | undefined>>({});
  const [fraudDetections, setFraudDetections] = useState<
    Record<string, FraudDetectionResponse | undefined>
  >({});
  const [loadingFraudPredictionIds, setLoadingFraudPredictionIds] = useState<string[]>([]);
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResponse[] | null>(null);
  const [statusUpdateClaimId, setStatusUpdateClaimId] = useState<string | null>(null);
  const [savingClaimId, setSavingClaimId] = useState<string | null>(null);
  const [deletingClaimId, setDeletingClaimId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const loadClaims = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchClaims();
        setClaims(response);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void loadClaims();
  }, []);

  useEffect(() => {
    setSelectedClaimIds((current) =>
      current.filter((claimId) => {
        const claim = claims.find((item) => item.id === claimId);
        return claim ? canClaimBeSelectedForValidation(claim) : false;
      })
    );
  }, [claims]);

  const insights = useMemo(() => claims.map(buildClaimInsight), [claims]);

  const metrics = useMemo(() => {
    const totalClaims = claims.length;
    const totalValue = claims.reduce((sum, claim) => sum + getClaimAmount(claim), 0);
    const validationReady = insights.filter((item) => item.lane === "Validation Ready").length;
    const reviewQueue = totalClaims - validationReady;

    return {
      totalClaims,
      totalValue,
      validationReady,
      reviewQueue,
      validationRate: totalClaims ? Math.round((validationReady / totalClaims) * 100) : 0,
    };
  }, [claims, insights]);

  const onValidateSelected = async () => {
    if (!selectedClaimIds.length) {
      return;
    }

    const nonEligibleSelectedClaims = claims.filter(
      (claim) => selectedClaimIds.includes(claim.id) && !canClaimBeSelectedForValidation(claim)
    );

    if (nonEligibleSelectedClaims.length) {
      setError("Validation only runs for claims with Active or Resubmit status.");
      return;
    }

    setError(null);
    const claimIdsToValidate = [...selectedClaimIds];
    const previousClaims = claims;

    setClaims((current) =>
      current.map((claim) =>
        claimIdsToValidate.includes(claim.id) ? { ...claim, status: "InProcess" } : claim
      )
    );

    try {
      const response = await validateClaims({ claimIds: claimIdsToValidate });
      const statusOverrides = await Promise.all(
        response.map(async (result) => {
          if (result.status !== "valid") {
            return [result.claimId, result.claimStatus ?? "Review"] as const;
          }

          const claim = previousClaims.find((item) => item.id === result.claimId);
          if (!claim) {
            return [result.claimId, result.claimStatus ?? "Submitted"] as const;
          }

          if (!getClaimProviderId(claim) && !getClaimProcedureCode(claim)) {
            return [result.claimId, "Submitted"] as const;
          }

          try {
            const fraudDetection = await detectFraud(claim);
            return [
              result.claimId,
              fraudDetection.denial_risk === "High" ? "Review" : "Submitted",
            ] as const;
          } catch {
            return [result.claimId, "Submitted"] as const;
          }
        })
      );

      const statusByClaimId = Object.fromEntries(statusOverrides);

      await Promise.all(
        statusOverrides.map(async ([claimId, status]) => {
          await updateClaimStatus(claimId, status);
        })
      );

      setValidationResult(
        response.map((result) => ({
          ...result,
          claimStatus: statusByClaimId[result.claimId] ?? result.claimStatus,
        }))
      );
      setClaims((current) =>
        current.map((claim) => {
          const nextStatus = statusByClaimId[claim.id];
          return nextStatus ? { ...claim, status: nextStatus } : claim;
        })
      );
      setSelectedClaimIds([]);
    } catch (err) {
      setClaims(previousClaims);
      setError((err as Error).message);
    }
  };

  const onMarkClaimForResubmit = async (claimId: string) => {
    setError(null);
    setDetailError(null);
    setStatusUpdateClaimId(claimId);
    try {
      const updatedClaim = await updateClaimStatus(claimId, "Resubmit");
      setClaims((current) =>
        current.map((claim) => (claim.id === updatedClaim.id ? { ...claim, ...updatedClaim } : claim))
      );
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      setDetailError(message);
    } finally {
      setStatusUpdateClaimId(null);
    }
  };

  const onSaveClaim = async (claimId: string, values: ClaimDraftValues) => {
    const currentClaim = claims.find((claim) => claim.id === claimId);
    if (!currentClaim) {
      setDetailError("Claim not found.");
      return;
    }

    setDetailError(null);
    setSavingClaimId(claimId);
    try {
      const nextClaim = buildClaimFromDraft(values, currentClaim);
      const updatedClaim = await updateClaim(claimId, nextClaim);
      setClaims((current) =>
        current.map((claim) => (claim.id === updatedClaim.id ? { ...claim, ...updatedClaim } : claim))
      );
      setFraudPredictions((current) => {
        const next = { ...current };
        delete next[claimId];
        return next;
      });
      setFraudDetections((current) => {
        const next = { ...current };
        delete next[claimId];
        return next;
      });
    } catch (err) {
      setDetailError((err as Error).message);
      throw err;
    } finally {
      setSavingClaimId(null);
    }
  };

  const onCreateClaim = async (values: ClaimDraftValues) => {
    setCreateError(null);
    setSavingClaimId(values.id);
    try {
      const nextClaim = buildClaimFromDraft(values);
      const createdClaim = await createClaim(nextClaim);
      setClaims((current) => [createdClaim, ...current]);
      setValidationResult(null);
      setSelectedClaimIds([]);
      return createdClaim;
    } catch (err) {
      const message = (err as Error).message;
      setCreateError(message);
      throw err;
    } finally {
      setSavingClaimId(null);
    }
  };

  const onDeleteClaim = async (claimId: string) => {
    const confirmed = window.confirm(`Delete claim ${claimId}?`);
    if (!confirmed) {
      return;
    }

    setError(null);
    setDeletingClaimId(claimId);
    try {
      await deleteClaim(claimId);
      setClaims((current) => current.filter((claim) => claim.id !== claimId));
      setSelectedClaimIds((current) => current.filter((id) => id !== claimId));
      setFraudPredictions((current) => {
        const next = { ...current };
        delete next[claimId];
        return next;
      });
      setFraudDetections((current) => {
        const next = { ...current };
        delete next[claimId];
        return next;
      });
      setValidationResult((current) => current?.filter((item) => item.claimId !== claimId) ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingClaimId(null);
    }
  };

  const onFetchFraudInsights = async (claimId: string) => {
    const claim = claims.find((item) => item.id === claimId);
    if (!claim || loadingFraudPredictionIds.includes(claimId)) {
      return;
    }

    setError(null);
    setLoadingFraudPredictionIds((current) => [...current, claimId]);

    try {
      const [prediction, detection] = await Promise.all([predictFraud(claim), detectFraud(claim)]);
      setFraudPredictions((current) => ({ ...current, [claimId]: prediction }));
      setFraudDetections((current) => ({ ...current, [claimId]: detection }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingFraudPredictionIds((current) => current.filter((id) => id !== claimId));
    }
  };

  return (
    <main className="rcm-shell min-h-screen">
      <div className="rcm-grid mx-auto max-w-7xl px-4 py-6 md:px-6 xl:px-8">
        {error ? (
          <section
            role="alert"
            className="mt-4 rounded-3xl border border-rose-300 bg-rose-50 px-5 py-4 text-sm text-rose-900"
          >
            {error}
          </section>
        ) : null}

        <Routes>
          <Route
            path="/"
            element={
              <section className="mt-6 space-y-4 rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="eyebrow text-slate-500">Claims Queue</p>
                    <h2 className="text-2xl font-semibold text-slate-950">Revenue Cycle Optimization</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      {metrics.totalClaims} claims | {currencyFormatter.format(metrics.totalValue)} total |{" "}
                      {metrics.validationReady} validation ready
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <Link
                      to="/claims/new"
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-900 transition hover:border-cyan-500 hover:text-cyan-700"
                    >
                      Create claim
                    </Link>
                    <button
                      type="button"
                      onClick={onValidateSelected}
                      disabled={!selectedClaimIds.length}
                      className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                    >
                      Run validation ({selectedClaimIds.length})
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-slate-500">
                    Loading claims...
                  </div>
                ) : (
                  <ClaimTable
                    claims={claims}
                    fraudPredictions={fraudPredictions}
                    loadingFraudPredictionIds={loadingFraudPredictionIds}
                    selectedClaimIds={selectedClaimIds}
                    onSelectionChange={setSelectedClaimIds}
                    onFetchFraudInsights={onFetchFraudInsights}
                    onDeleteClaim={onDeleteClaim}
                    deletingClaimId={deletingClaimId}
                  />
                )}

                {validationResult ? (
                  <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="eyebrow text-slate-500">Validation Response</p>
                    <div className="mt-3 grid gap-2">
                      {validationResult.map((result) => (
                        <p
                          key={result.claimId}
                          className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-700"
                        >
                          {result.claimId} | {result.status} | {result.coverageStatus}
                        </p>
                      ))}
                    </div>
                  </section>
                ) : null}
              </section>
            }
          />
          <Route
            path="/claims/new"
            element={
              <CreateClaimPage
                creating={savingClaimId !== null}
                error={createError}
                onCreateClaim={onCreateClaim}
              />
            }
          />
          <Route
            path="/claims/:id"
            element={
              <ClaimDetails
                claims={claims}
                insights={insights}
                fraudPredictions={fraudPredictions}
                fraudDetections={fraudDetections}
                loadingFraudPredictionIds={loadingFraudPredictionIds}
                savingClaimId={savingClaimId}
                detailError={detailError}
                onSaveClaim={onSaveClaim}
                onMarkClaimForResubmit={onMarkClaimForResubmit}
                statusUpdateClaimId={statusUpdateClaimId}
                onFetchFraudInsights={onFetchFraudInsights}
              />
            }
          />
        </Routes>
      </div>
    </main>
  );
}

function CreateClaimPage({
  creating,
  error,
  onCreateClaim,
}: {
  creating: boolean;
  error: string | null;
  onCreateClaim: (values: ClaimDraftValues) => Promise<Claim>;
}) {
  const navigate = useNavigate();

  const handleCreate = async (values: ClaimDraftValues) => {
    const createdClaim = await onCreateClaim(values);
    navigate(`/claims/${createdClaim.id}`);
  };

  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
        <Link to="/" className="text-sm font-medium text-cyan-700 hover:text-cyan-800">
          Back to claims
        </Link>
        <div className="mt-4 max-w-3xl">
          <h2 className="text-2xl font-semibold text-slate-950">Create a new claim</h2>
        </div>
      </div>

      <div className="max-w-3xl">
        <ClaimForm mode="create" onSubmit={handleCreate} saving={creating} error={error} />
      </div>
    </section>
  );
}

function ClaimDetails({
  claims,
  insights,
  fraudPredictions,
  fraudDetections,
  loadingFraudPredictionIds,
  savingClaimId,
  detailError,
  onSaveClaim,
  onMarkClaimForResubmit,
  statusUpdateClaimId,
  onFetchFraudInsights,
}: {
  claims: Claim[];
  insights: ClaimInsight[];
  fraudPredictions: Record<string, FraudPrediction | undefined>;
  fraudDetections: Record<string, FraudDetectionResponse | undefined>;
  loadingFraudPredictionIds: string[];
  savingClaimId: string | null;
  detailError: string | null;
  onSaveClaim: (claimId: string, values: ClaimDraftValues) => Promise<void>;
  onMarkClaimForResubmit: (claimId: string) => Promise<void>;
  statusUpdateClaimId: string | null;
  onFetchFraudInsights: (claimId: string) => Promise<void>;
}) {
  const { id } = useParams();
  const [patient, setPatient] = useState<PatientSummary | null>(null);

  const claim = useMemo(() => claims.find((item) => item.id === id), [claims, id]);
  const insight = useMemo(() => insights.find((item) => item.claim.id === id) ?? null, [id, insights]);

  useEffect(() => {
    const loadPatient = async () => {
      if (!claim) {
        setPatient(null);
        return;
      }

      const patientId = getClaimPatientId(claim);
      if (!patientId) {
        setPatient(null);
        return;
      }

      try {
        const response = await fetchPatient(patientId);
        setPatient(response);
      } catch {
        setPatient(null);
      }
    };

    void loadPatient();
  }, [claim]);

  useEffect(() => {
    if (!claim) {
      return;
    }

    if (fraudPredictions[claim.id] && fraudDetections[claim.id]) {
      return;
    }

    void onFetchFraudInsights(claim.id);
  }, [claim, fraudDetections, fraudPredictions, onFetchFraudInsights]);

  if (!claim || !insight) {
    return (
      <section className="mt-6 rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
        <Link to="/" className="text-sm font-medium text-cyan-700 hover:text-cyan-800">
          Back to claims
        </Link>
        <p className="mt-4 text-slate-700">Claim not found.</p>
      </section>
    );
  }

  const diagnosisList =
    claim.diagnosis?.map(
      (entry) =>
        `Dx ${entry.sequence ?? "-"} | ${
          entry.diagnosisCodeableConcept?.text ||
          entry.diagnosisReference?.display ||
          entry.diagnosisReference?.reference ||
          "Unknown diagnosis"
        }`
    ) ?? [];

  const procedureList =
    claim.procedure?.map(
      (entry) =>
        `Px ${entry.sequence ?? "-"} | ${
          entry.procedureCodeableConcept?.text ||
          entry.procedureReference?.display ||
          entry.procedureReference?.reference ||
          "Unknown procedure"
        }`
    ) ?? [];

  const supportingInfoList =
    claim.supportingInfo?.map(
      (entry) =>
        `Info ${entry.sequence ?? "-"} | ${
          entry.valueReference?.display ||
          entry.valueReference?.reference ||
          entry.category?.coding?.[0]?.code ||
          "Supporting info"
        }`
    ) ?? [];

  const handleSave = async (values: ClaimDraftValues) => {
    await onSaveClaim(claim.id, values);
  };

  const fraudPrediction = fraudPredictions[claim.id];
  const fraudDetection = fraudDetections[claim.id];
  const fraudInsightsLoading = loadingFraudPredictionIds.includes(claim.id);
  const fraudWarnings = fraudPrediction?.warnings ?? [];

  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Link to="/" className="text-sm font-medium text-cyan-700 hover:text-cyan-800">
              Back to claims
            </Link>
            <div>
              <p className="eyebrow text-slate-500">Claim Details</p>
              <h2 className="text-2xl font-semibold text-slate-950">{claim.id}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {getClaimPatientLabel(claim)} | {getClaimProcedureLabel(claim)}
              </p>
            </div>
          </div>

          {fraudPrediction ? (
            <div className="rounded-[22px] border border-cyan-100 bg-cyan-50 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-700">Risk score</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{fraudPrediction.risk_score}</p>
              <p className="mt-1 text-sm text-slate-600">{fraudPrediction.fraud_risk} fraud risk</p>
            </div>
          ) : fraudInsightsLoading ? (
            <div className="rounded-[22px] border border-cyan-100 bg-cyan-50 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-700">Fraud review</p>
              <p className="mt-2 text-sm font-medium text-slate-700">Loading latest prediction and denial checks...</p>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DetailMetric label="Status" value={getClaimStatusLabel(claim)} />
          <DetailMetric label="Type" value={getClaimTypeLabel(claim)} />
          <DetailMetric label="Priority" value={getClaimPriorityLabel(claim)} />
          <DetailMetric label="Created" value={formatDate(claim.created)} />
          <DetailMetric label="Payer" value={getClaimPayerLabel(claim)} />
          <DetailMetric label="Provider" value={claim.provider?.display ?? "Unknown provider"} />
          <DetailMetric label="Billable period" value={formatPeriod(claim)} />
          <DetailMetric
            label="Claim amount"
            value={currencyFormatter.format(getClaimAmount(claim))}
          />
          {fraudPrediction ? (
            <DetailMetric label="Predictive warnings" value={String(fraudWarnings.length)} />
          ) : null}
          {fraudDetection ? (
            <DetailMetric label="Denial risk" value={fraudDetection.denial_risk} />
          ) : null}
          {fraudDetection ? (
            <DetailMetric
              label="Denial rate"
              value={`${Math.round(fraudDetection.denial_rate * 100)}%`}
            />
          ) : null}
        </div>

        <div className="mt-5">
          <PayerRuleAlert
            status={claim.payerRuleStatus}
            message={claim.payerRuleMessage ?? getClaimPayerLabel(claim)}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          {fraudPrediction ? <DetailList title="Predictive Warnings" items={fraudWarnings} /> : null}
          <DetailList title="Audit Findings" items={insight.findings} />
          <DetailList title="Human Review Triggers" items={insight.blockers} />
          <DetailList title="Diagnosis Mapping" items={diagnosisList} />
          <DetailList title="Procedure Mapping" items={procedureList} />
          <DetailList title="Supporting Info" items={supportingInfoList} />
          <ServiceLines claim={claim} />
        </div>

        <div className="space-y-4">
          <ClaimForm
            mode="edit"
            claim={claim}
            onSubmit={handleSave}
            saving={savingClaimId === claim.id}
            error={detailError}
            onMarkForResubmit={onMarkClaimForResubmit}
            resubmitSaving={statusUpdateClaimId === claim.id}
          />
          {patient ? <PatientSummaryCard patient={patient} /> : null}
        </div>
      </div>
    </section>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
      <p className="eyebrow text-slate-500">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <p key={item} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {item}
            </p>
          ))
        ) : (
          <p className="text-sm text-slate-500">None attached</p>
        )}
      </div>
    </section>
  );
}

function ServiceLines({ claim }: { claim: Claim }) {
  return (
    <section className="rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
      <p className="eyebrow text-slate-500">Service Lines</p>
      <div className="mt-3 space-y-3">
        {claim.item?.length ? (
          claim.item.map((item) => (
            <div
              key={`${claim.id}-${item.sequence ?? "line"}`}
              className="rounded-[20px] border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Line {item.sequence ?? "-"} |{" "}
                    {item.productOrService?.text ||
                      item.productOrService?.coding?.[0]?.display ||
                      item.productOrService?.coding?.[0]?.code ||
                      "Unknown service"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    System: {item.productOrService?.coding?.[0]?.system ?? "Unknown system"}
                  </p>
                </div>
                <p className="text-sm font-medium text-slate-800">
                  {typeof item.net?.value === "number"
                    ? currencyFormatter.format(item.net.value)
                    : "No line amount"}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No line items attached.</p>
        )}
      </div>
    </section>
  );
}

export default App;
