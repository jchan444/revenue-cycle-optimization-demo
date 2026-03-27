import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Claim } from "../types/claim";
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
          [claim.id, claim.patient, claim.procedure]
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
      : claims;

    return [...base].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      if (sortBy === "amount") {
        return (a.amount - b.amount) * direction;
      }
      return a[sortBy].localeCompare(b[sortBy]) * direction;
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
    <section className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Claims</h2>
        <input
          tabIndex={0}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by ID, patient, procedure"
          className="w-full max-w-md rounded-md border border-slate-400 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          aria-label="Search claims"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-900">
              <th className="p-2">Select</th>
              {(["id", "patient", "procedure", "amount"] as SortKey[]).map((key) => (
                <th key={key} className="p-2">
                  <button
                    tabIndex={0}
                    type="button"
                    onClick={() => toggleSort(key)}
                    className="font-semibold text-slate-900 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {key.toUpperCase()}
                    {isSortActive(key) ? ` (${sortDirection})` : ""}
                  </button>
                </th>
              ))}
              <th className="p-2">Payer Rule</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClaims.map((claim) => (
              <tr key={claim.id} className="border-b border-slate-200 text-slate-900">
                <td className="p-2">
                  <input
                    tabIndex={0}
                    type="checkbox"
                    checked={selectedClaimIds.includes(claim.id)}
                    onChange={() => onSelectClaim(claim.id)}
                    aria-label={`Select claim ${claim.id}`}
                  />
                </td>
                <td className="p-2">{claim.id}</td>
                <td className="p-2">{claim.patient}</td>
                <td className="p-2">{claim.procedure}</td>
                <td className="p-2">${claim.amount.toFixed(2)}</td>
                <td className="p-2">
                  <PayerRuleAlert
                    status={claim.payerRuleStatus}
                    message={claim.payerRuleMessage}
                  />
                </td>
                <td className="p-2">
                  <button
                    tabIndex={0}
                    type="button"
                    onClick={() => navigate(`/claims/${claim.id}`)}
                    className="rounded-md bg-blue-700 px-3 py-1.5 font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
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
