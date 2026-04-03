import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Claim,
  getClaimAmount,
  getClaimPatientLabel,
  getClaimProcedureLabel,
  getClaimPayerLabel,
} from "../types/claim";
import PayerRuleAlert from "./PayerRuleAlert";

interface ClaimTableProps {
  claims: Claim[];
  selectedClaimIds: string[];
  onSelectionChange: (claimIds: string[]) => void;
}

type SortKey = "id" | "patient" | "procedure" | "amount";

function ClaimTable({
  claims,
  selectedClaimIds,
  onSelectionChange,
}: ClaimTableProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

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
      if (sortBy === "amount") {
        return (getClaimAmount(a) - getClaimAmount(b)) * direction;
      }

      const left =
        sortBy === "patient"
          ? getClaimPatientLabel(a)
          : sortBy === "procedure"
            ? getClaimProcedureLabel(a)
            : a.id;
      const right =
        sortBy === "patient"
          ? getClaimPatientLabel(b)
          : sortBy === "procedure"
            ? getClaimProcedureLabel(b)
            : b.id;

      return left.localeCompare(right) * direction;
    });
  }, [claims, search, sortBy, sortDirection]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(key);
    setSortDirection("asc");
  };

  const onSelectClaim = (id: string) => {
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
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by ID, patient, procedure"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 md:max-w-md"
          aria-label="Search claims"
        />
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-900">
              <th className="px-4 py-4 font-semibold">Select</th>
              {(["id", "patient", "procedure", "amount"] as SortKey[]).map((key) => (
                <th key={key} className="px-4 py-4 font-semibold">
                  <button
                    type="button"
                    onClick={() => toggleSort(key)}
                    className="font-semibold text-slate-900 transition hover:text-cyan-700"
                  >
                    {key === "id" ? `ID${isSortActive(key) ? ` (${sortDirection})` : ""}` : key.toUpperCase()}
                  </button>
                </th>
              ))}
              <th className="px-4 py-4 font-semibold">Payer Rule</th>
              <th className="px-4 py-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClaims.map((claim) => (
              <tr key={claim.id} className="border-b border-slate-100 text-slate-900 last:border-b-0">
                <td className="px-4 py-4 align-top">
                  <input
                    type="checkbox"
                    checked={selectedClaimIds.includes(claim.id)}
                    onChange={() => onSelectClaim(claim.id)}
                    aria-label={`Select claim ${claim.id}`}
                  />
                </td>
                <td className="max-w-[220px] px-4 py-4 align-top font-medium break-words">
                  {claim.id}
                </td>
                <td className="max-w-[240px] px-4 py-4 align-top break-words">
                  {getClaimPatientLabel(claim)}
                </td>
                <td className="min-w-[280px] px-4 py-4 align-top">
                  {getClaimProcedureLabel(claim)}
                </td>
                <td className="px-4 py-4 align-top font-medium">
                  ${getClaimAmount(claim).toFixed(2)}
                </td>
                <td className="px-4 py-4 align-top">
                  <PayerRuleAlert
                    status={claim.payerRuleStatus}
                    message={claim.payerRuleMessage ?? getClaimPayerLabel(claim)}
                  />
                </td>
                <td className="px-4 py-4 align-top">
                  <button
                    type="button"
                    onClick={() => navigate(`/claims/${claim.id}`)}
                    className="rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white transition hover:bg-blue-800"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ClaimTable;
