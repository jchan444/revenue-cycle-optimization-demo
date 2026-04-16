import React from "react";
import { Claim, getClaimStatusLabel } from "../types/claim";

interface ClaimFormProps {
  claim: Claim;
  onMarkForResubmit: (claimId: string) => Promise<void> | void;
  saving?: boolean;
}

function ClaimForm({ claim, onMarkForResubmit, saving = false }: ClaimFormProps) {
  const status = getClaimStatusLabel(claim);
  const canMarkResubmit = status !== "InProcess" && status !== "Resubmit";

  return (
    <section className="rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
      <p className="eyebrow text-slate-500">Claim Data Form</p>
      <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">Current status</p>
          <p className="mt-1 text-sm text-slate-600">{status}</p>
        </div>

        <button
          type="button"
          onClick={() => onMarkForResubmit(claim.id)}
          disabled={!canMarkResubmit || saving}
          className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {saving ? "Updating..." : "Mark as Resubmit"}
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Use this action to manually move the claim back into the validation queue.
      </p>
    </section>
  );
}

export default ClaimForm;
