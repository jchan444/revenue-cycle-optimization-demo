import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Claim,
  canClaimBeSelectedForValidation,
  getClaimPatientLabel,
  getClaimPayerLabel,
  getClaimProcedureLabel,
  getClaimStatusLabel,
} from "../types/claim";

interface ClaimInsightSummary {
  claim: Claim;
  score: number;
  findings: string[];
  blockers: string[];
}

interface ClaimTableProps {
  claims: Claim[];
  insights: ClaimInsightSummary[];
  selectedClaimIds: string[];
  onSelectionChange: (claimIds: string[]) => void;
}

type SortKey = "id" | "patient" | "procedure" | "status" | "errors" | "warnings" | "riskScore";

const PAGE_SIZE = 20;

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
  insights,
  selectedClaimIds,
  onSelectionChange,
}: ClaimTableProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const insightMap = useMemo(
    () =>
      new Map(
        insights.map((insight) => [
          insight.claim.id,
          {
            errors: insight.blockers.length,
            warnings: insight.findings.length,
            riskScore: insight.score,
          },
        ])
      ),
    [insights]
  );

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
      if (sortBy === "errors" || sortBy === "warnings" || sortBy === "riskScore") {
        const left = insightMap.get(a.id)?.[sortBy] ?? 0;
        const right = insightMap.get(b.id)?.[sortBy] ?? 0;
        return (left - right) * direction;
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
  }, [claims, insightMap, search, sortBy, sortDirection]);

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
            <col style={{ width: "24%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-900">
              <th className="px-4 py-4 font-semibold">Select</th>
              {(["id", "patient", "procedure", "status", "errors", "warnings", "riskScore"] as SortKey[]).map((key) => (
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
              const insight = insightMap.get(claim.id) ?? { errors: 0, warnings: 0, riskScore: 0 };
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
                  <td className="px-3 py-4 align-middle font-medium">
                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap" title={claim.id}>
                      {claim.id}
                    </span>
                  </td>
                  <td className="px-3 py-4 align-middle">
                    <span
                      className="block overflow-hidden text-ellipsis whitespace-nowrap"
                      title={getClaimPatientLabel(claim)}
                    >
                      {getClaimPatientLabel(claim)}
                    </span>
                  </td>
                  <td className="px-3 py-4 align-middle">
                    <span
                      className="block overflow-hidden text-ellipsis whitespace-nowrap"
                      title={getClaimProcedureLabel(claim)}
                    >
                      {getClaimProcedureLabel(claim)}
                    </span>
                  </td>
                  <td className="px-3 py-4 align-middle">
                    <span className="inline-flex rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold uppercase text-slate-900">
                      {getClaimStatusLabel(claim)}
                    </span>
                  </td>
                  <td className="px-2 py-4 align-middle font-medium whitespace-nowrap">
                    {insight.errors}
                  </td>
                  <td className="px-2 py-4 align-middle font-medium whitespace-nowrap">
                    {insight.warnings}
                  </td>
                  <td className="px-2 py-4 align-middle font-medium whitespace-nowrap">
                    {insight.riskScore}
                  </td>
                  <td className="px-3 py-4 align-middle whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => navigate(`/claims/${claim.id}`)}
                      className="w-full rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                    >
                      View
                    </button>
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

export default ClaimTable;
