import React, { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useParams } from "react-router-dom";
import ClaimTable from "./components/ClaimTable";
import PatientSummaryCard from "./components/PatientSummaryCard";
import PayerRuleAlert from "./components/PayerRuleAlert";
import { fetchClaims, fetchPatient, optimizeClaims } from "./services";
import { Claim, PatientSummary, ValidationResponse } from "./types/claim";

function App() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<ValidationResponse[] | null>(
    null
  );

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

  const onOptimizeSelected = async () => {
    if (!selectedClaimIds.length) return;
    setError(null);
    try {
      const response = await optimizeClaims({ claimIds: selectedClaimIds });
      setOptimizeResult(response);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">
            Revenue Cycle Optimization
          </h1>
          <Link
            tabIndex={0}
            to="/"
            className="rounded-md border border-slate-400 bg-white px-3 py-1.5 text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            Home
          </Link>
        </header>

        {error ? (
          <p
            tabIndex={0}
            role="alert"
            className="rounded-md border border-rose-800 bg-rose-100 p-3 text-rose-900"
          >
            {error}
          </p>
        ) : null}

        <Routes>
          <Route
            path="/"
            element={
              <section className="space-y-4">
                {loading ? (
                  <p tabIndex={0} className="text-slate-900">
                    Loading claims...
                  </p>
                ) : (
                  <ClaimTable
                    claims={claims}
                    selectedClaimIds={selectedClaimIds}
                    onSelectionChange={setSelectedClaimIds}
                  />
                )}

                <div className="flex items-center gap-3">
                  <button
                    tabIndex={0}
                    type="button"
                    onClick={onOptimizeSelected}
                    disabled={selectedClaimIds.length === 0}
                    className="rounded-md bg-indigo-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-500"
                  >
                    Optimize Selected
                  </button>
                  <p tabIndex={0} className="text-sm text-slate-900">
                    Selected claims: {selectedClaimIds.length}
                  </p>
                </div>

                {optimizeResult ? (
                  <section
                    tabIndex={0}
                    className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
                  >
                    <h2 className="mb-2 text-lg font-semibold text-slate-900">
                      Optimization Response
                    </h2>
                    <ul className="space-y-1 text-sm text-slate-900">
                      {optimizeResult.map((result) => (
                        <li key={result.claimId}>
                          Claim {result.claimId}: {result.status} (
                          {result.coverageStatus})
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </section>
            }
          />
          <Route path="/claims/:id" element={<ClaimDetails claims={claims} />} />
        </Routes>
      </div>
    </main>
  );
}

function ClaimDetails({ claims }: { claims: Claim[] }) {
  const { id } = useParams();
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const claim = useMemo(() => claims.find((item) => item.id === id), [claims, id]);

  useEffect(() => {
    if (!claim) return;
    const loadPatient = async () => {
      setError(null);
      try {
        const data = await fetchPatient(claim.patient);
        setPatient(data);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    void loadPatient();
  }, [claim]);

  if (!claim) {
    return (
      <section
        tabIndex={0}
        className="rounded-lg border border-slate-300 bg-white p-4 text-slate-900 shadow-sm"
      >
        Claim not found.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Claim Details: {claim.id}
        </h2>
        <p tabIndex={0} className="text-sm text-slate-900">
          Procedure: {claim.procedure}
        </p>
        <p tabIndex={0} className="text-sm text-slate-900">
          Amount: ${claim.amount.toFixed(2)}
        </p>
        <div className="mt-2">
          <PayerRuleAlert
            status={claim.payerRuleStatus}
            message={claim.payerRuleMessage}
          />
        </div>
      </div>

      {error ? (
        <p
          tabIndex={0}
          role="alert"
          className="rounded-md border border-rose-800 bg-rose-100 p-3 text-rose-900"
        >
          {error}
        </p>
      ) : null}

      {patient ? <PatientSummaryCard patient={patient} /> : null}
    </section>
  );
}

export default App;