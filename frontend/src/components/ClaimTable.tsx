import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Claim,
  FraudPrediction,
  canClaimBeSelectedForValidation,
  getClaimPatientLabel,
  getClaimPayerLabel,
  getClaimProcedureLabel,
  getClaimStatusLabel,
} from "../types/claim";

interface ClaimTableProps {
  claims: Claim[];
  fraudPredictions: Record<string, FraudPrediction | undefined>;
  loadingFraudPredictionIds: string[];
  selectedClaimIds: string[];
  onSelectionChange: (claimIds: string[]) => void;
  onFetchFraudInsights: (claimId: string) => Promise<void>;
  onDeleteClaim: (claimId: string) => Promise<void>;
  deletingClaimId: string | null;
}

type SortKey = "id" | "patient" | "procedure" | "status" | "fraudRisk" | "warnings" | "riskScore";

const PAGE_SIZE = 20;
const THREE_LINE_CLAMP_STYLE = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 3,
  overflow: "hidden",
};

const buildPaginationItems = (currentPage: number, totalPages: number): Array<number | "ellipsis"> => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
};

function ClaimTable({
  claims,
  fraudPredictions,
  loadingFraudPredictionIds,
  selectedClaimIds,
  onSelectionChange,
  onFetchFraudInsights,
  onDeleteClaim,
  deletingClaimId,
}: ClaimTableProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuClaimId, setOpenMenuClaimId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const filteredClaims = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = query
      ? claims.filter((claim) =>
          [
            claim.id,
            getClaimPatientLabel(claim),
            getClaimProcedureLabel(claim),
            getClaimPayerLabel(claim),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
      : claims;

    return [...base].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      if (sortBy === "warnings" || sortBy === "riskScore") {
        const left =
          sortBy === "warnings"
            ? fraudPredictions[a.id]?.warnings.length ?? 0
            : fraudPredictions[a.id]?.risk_score ?? 0;
        const right =
          sortBy === "warnings"
            ? fraudPredictions[b.id]?.warnings.length ?? 0
            : fraudPredictions[b.id]?.risk_score ?? 0;
        return (left - right) * direction;
      }
      if (sortBy === "fraudRisk") {
        return (
          (getFraudRiskRank(fraudPredictions[a.id]?.fraud_risk) -
            getFraudRiskRank(fraudPredictions[b.id]?.fraud_risk)) *
          direction
        );
      }

      const left =
        sortBy === "patient"
          ? getClaimPatientLabel(a)
          : sortBy === "procedure"
            ? getClaimProcedureLabel(a)
            : sortBy === "status"
              ? getClaimStatusLabel(a)
            : a.id;
      const right =
        sortBy === "patient"
          ? getClaimPatientLabel(b)
          : sortBy === "procedure"
            ? getClaimProcedureLabel(b)
            : sortBy === "status"
              ? getClaimStatusLabel(b)
            : b.id;

      return left.localeCompare(right) * direction;
    });
  }, [claims, fraudPredictions, search, sortBy, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredClaims.length / PAGE_SIZE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedClaims = useMemo(() => {
    const start = (currentPageSafe - 1) * PAGE_SIZE;
    return filteredClaims.slice(start, start + PAGE_SIZE);
  }, [currentPageSafe, filteredClaims]);
  const paginationItems = useMemo(
    () => buildPaginationItems(currentPageSafe, totalPages),
    [currentPageSafe, totalPages]
  );

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, sortBy, sortDirection]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  React.useEffect(() => {
    if (!openMenuClaimId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuClaimId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuClaimId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuClaimId]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(key);
    setSortDirection("asc");
  };

  const onSelectClaim = (id: string) => {
    const claim = claims.find((item) => item.id === id);
    if (!claim || !canClaimBeSelectedForValidation(claim)) {
      return;
    }

    if (selectedClaimIds.includes(id)) {
      onSelectionChange(selectedClaimIds.filter((claimId) => claimId !== id));
      return;
    }

    onSelectionChange([...selectedClaimIds, id]);
  };

  const isSortActive = (key: SortKey) => sortBy === key;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-xl font-semibold text-slate-950">Claims</h3>
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setCurrentPage(1);
          }}
          placeholder="Search by ID, patient, procedure"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 md:max-w-md"
          aria-label="Search claims"
        />
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: "52px" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-900">
              <th className="px-4 py-4 font-semibold">Select</th>
              {(["id", "patient", "procedure", "status", "fraudRisk", "riskScore", "warnings"] as SortKey[]).map((key) => (
                <th key={key} className="px-4 py-4 font-semibold">
                  <button
                    type="button"
                    onClick={() => toggleSort(key)}
                    className="font-semibold text-slate-900 transition hover:text-cyan-700"
                  >
                    {(() => {
                      const label =
                        key === "id"
                          ? "ID"
                          : key === "status"
                            ? "Status"
                            : key === "fraudRisk"
                              ? "Fraud risk"
                            : key === "riskScore"
                              ? "Risk score"
                            : key.charAt(0).toUpperCase() + key.slice(1);
                      return `${label}${isSortActive(key) ? ` (${sortDirection})` : ""}`;
                    })()}
                  </button>
                </th>
              ))}
              <th className="px-4 py-4 font-semibold whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedClaims.map((claim) => {
              const canSelect = canClaimBeSelectedForValidation(claim);
              const fraudPrediction = fraudPredictions[claim.id];
              const fraudPredictionLoading = loadingFraudPredictionIds.includes(claim.id);
              const warningText = fraudPrediction?.warnings.length
                ? fraudPrediction.warnings.join(" | ")
                : "";
              return (
                <tr
                  key={claim.id}
                  className={`border-b border-slate-100 text-slate-900 last:border-b-0 ${!canSelect ? "bg-slate-50/80" : ""}`}
                >
                  <td className="px-4 py-4 align-top">
                    <input
                      type="checkbox"
                      checked={selectedClaimIds.includes(claim.id)}
                      onChange={() => onSelectClaim(claim.id)}
                      disabled={!canSelect}
                      aria-label={
                        canSelect
                          ? `Select claim ${claim.id}`
                          : `Claim ${claim.id} cannot be selected because status is ${getClaimStatusLabel(claim)}`
                      }
                    />
                  </td>
                  <td className="px-3 py-4 align-top font-medium">
                    <span className="block break-words" style={THREE_LINE_CLAMP_STYLE} title={claim.id}>
                      {claim.id}
                    </span>
                  </td>
                  <td className="px-3 py-4 align-top">
                    <span className="block break-words" style={THREE_LINE_CLAMP_STYLE} title={getClaimPatientLabel(claim)}>
                      {getClaimPatientLabel(claim)}
                    </span>
                  </td>
                  <td className="px-3 py-4 align-top">
                    <span className="block break-words" style={THREE_LINE_CLAMP_STYLE} title={getClaimProcedureLabel(claim)}>
                      {getClaimProcedureLabel(claim)}
                    </span>
                  </td>
                  <td className="px-3 py-4 align-middle">
                    <span className="inline-flex rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold uppercase text-slate-900">
                      {getClaimStatusLabel(claim)}
                    </span>
                  </td>
                  <td className="px-2 py-4 align-middle font-medium whitespace-nowrap">
                    {fraudPrediction ? (
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${getFraudRiskBadgeClass(fraudPrediction.fraud_risk)}`}
                      >
                        {fraudPrediction.fraud_risk}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onFetchFraudInsights(claim.id)}
                        disabled={fraudPredictionLoading}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                      >
                        {fraudPredictionLoading ? "Loading..." : "Fetch"}
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-4 align-top font-medium">
                    {fraudPrediction?.risk_score ?? ""}
                  </td>
                  <td className="px-3 py-4 align-top">
                    <span className="block break-words" style={THREE_LINE_CLAMP_STYLE} title={warningText}>
                      {warningText}
                    </span>
                  </td>
                  <td className="px-2 py-4 align-top">
                    <div className="relative flex justify-end" ref={openMenuClaimId === claim.id ? menuRef : null}>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuClaimId((current) => (current === claim.id ? null : claim.id))
                        }
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700"
                        aria-haspopup="menu"
                        aria-expanded={openMenuClaimId === claim.id}
                        aria-label={`Open actions for claim ${claim.id}`}
                      >
                        <span className="flex flex-col items-center justify-center gap-1" aria-hidden="true">
                          <span className="h-1 w-1 rounded-full bg-current" />
                          <span className="h-1 w-1 rounded-full bg-current" />
                          <span className="h-1 w-1 rounded-full bg-current" />
                        </span>
                      </button>

                      {openMenuClaimId === claim.id ? (
                        <div
                          role="menu"
                          aria-label={`Actions for claim ${claim.id}`}
                          className="absolute right-0 top-12 z-10 min-w-[140px] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.14)]"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuClaimId(null);
                              navigate(`/claims/${claim.id}`);
                            }}
                            className="flex w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-cyan-700"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuClaimId(null);
                              void onDeleteClaim(claim.id);
                            }}
                            disabled={deletingClaimId === claim.id}
                            className="flex w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            {deletingClaimId === claim.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-slate-500">
          Showing {filteredClaims.length ? (currentPageSafe - 1) * PAGE_SIZE + 1 : 0}-
          {Math.min(currentPageSafe * PAGE_SIZE, filteredClaims.length)} of {filteredClaims.length} results
        </p>
        {filteredClaims.length > PAGE_SIZE ? (
          <nav aria-label="Claims pagination" className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPageSafe === 1}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
            >
              Previous
            </button>
            {paginationItems.map((item, index) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="px-2 text-sm text-slate-400" aria-hidden="true">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCurrentPage(item)}
                  aria-current={item === currentPageSafe ? "page" : undefined}
                  className={`min-w-10 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    item === currentPageSafe
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 text-slate-700 hover:border-cyan-400 hover:text-cyan-700"
                  }`}
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPageSafe === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
            >
              Next
            </button>
          </nav>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">
        Only claims with status <span className="font-semibold text-slate-700">Active</span> or{" "}
        <span className="font-semibold text-slate-700">Resubmit</span> can be selected for validation.
      </p>
    </section>
  );
}

const getFraudRiskRank = (value?: string): number => {
  if (value === "High") {
    return 3;
  }
  if (value === "Average") {
    return 2;
  }
  if (value === "Low") {
    return 1;
  }
  return 0;
};

const getFraudRiskBadgeClass = (value?: string): string => {
  if (value === "High") {
    return "bg-rose-100 text-rose-800";
  }
  if (value === "Average") {
    return "bg-amber-100 text-amber-800";
  }
  if (value === "Low") {
    return "bg-emerald-100 text-emerald-800";
  }
  return "bg-slate-200 text-slate-700";
};

export default ClaimTable;
