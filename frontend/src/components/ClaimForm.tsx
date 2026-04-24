import React, { useEffect, useMemo, useState } from "react";
import {
  Claim,
  ClaimDraftValues,
  CLAIM_STATUS_OPTIONS,
  claimToDraftValues,
} from "../types/claim";

interface ClaimFormProps {
  mode: "create" | "edit";
  claim?: Claim;
  onSubmit: (values: ClaimDraftValues) => Promise<void> | void;
  saving?: boolean;
  error?: string | null;
  onMarkForResubmit?: (claimId: string) => Promise<void> | void;
  resubmitSaving?: boolean;
}

type FieldErrors = Partial<Record<keyof ClaimDraftValues, string>>;

const emptyDraft = claimToDraftValues();

function ClaimForm({
  mode,
  claim,
  onSubmit,
  saving = false,
  error = null,
  onMarkForResubmit,
  resubmitSaving = false,
}: ClaimFormProps) {
  const [values, setValues] = useState<ClaimDraftValues>(claim ? claimToDraftValues(claim) : emptyDraft);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    setValues(claim ? claimToDraftValues(claim) : emptyDraft);
    setFieldErrors({});
  }, [claim, mode]);

  const status = values.status;
  const canMarkResubmit =
    mode === "edit" &&
    !!claim &&
    !!onMarkForResubmit &&
    status !== "InProcess" &&
    status !== "Resubmit";

  const validationErrors = useMemo(() => validate(values, mode), [mode, values]);

  const handleChange =
    (key: keyof ClaimDraftValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const nextValue = event.target.value;
      setValues((current) => ({ ...current, [key]: nextValue }));
      setFieldErrors((current) => {
        if (!current[key]) {
          return current;
        }

        const nextErrors = { ...current };
        delete nextErrors[key];
        return nextErrors;
      });
    };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors);
      return;
    }

    await onSubmit(values);
  };

  return (
    <section className="rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="eyebrow text-slate-500">
            {mode === "create" ? "Create Claim" : "Claim Data Form"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {mode === "create"
              ? "Add a new claim to the queue with the fields expected by the backend."
              : "Update the claim body used by PUT /claims/{claim_id}."}
          </p>
        </div>

        {mode === "edit" ? (
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Current status: <span className="font-semibold text-slate-900">{status}</span>
          </div>
        ) : null}
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Claim ID"
            value={values.id}
            onChange={handleChange("id")}
            error={fieldErrors.id}
            disabled={mode === "edit"}
            helperText={mode === "edit" ? "Claim IDs stay fixed during updates." : undefined}
          />
          <SelectField
            label="Status"
            value={values.status}
            onChange={handleChange("status")}
            error={fieldErrors.status}
            options={CLAIM_STATUS_OPTIONS}
          />
          <Field
            label="Patient ID"
            value={values.patientId}
            onChange={handleChange("patientId")}
            error={fieldErrors.patientId}
          />
          <Field
            label="Provider ID"
            value={values.providerId}
            onChange={handleChange("providerId")}
            error={fieldErrors.providerId}
          />
          <Field
            label="Procedure Code"
            value={values.procedureCode}
            onChange={handleChange("procedureCode")}
            error={fieldErrors.procedureCode}
          />
          <Field
            label="Insurance ID"
            value={values.insuranceId}
            onChange={handleChange("insuranceId")}
            error={fieldErrors.insuranceId}
          />
          <Field
            label="Diagnosis Code"
            value={values.diagnosisCode}
            onChange={handleChange("diagnosisCode")}
            error={fieldErrors.diagnosisCode}
            helperText="Optional, but recommended for fraud prediction and justification confidence."
          />
          <Field
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            value={values.amount}
            onChange={handleChange("amount")}
            error={fieldErrors.amount}
          />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            {saving
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create claim"
                : "Save claim"}
          </button>

          {canMarkResubmit && claim ? (
            <button
              type="button"
              onClick={() => onMarkForResubmit?.(claim.id)}
              disabled={resubmitSaving}
              className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {resubmitSaving ? "Updating..." : "Mark as Resubmit"}
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function validate(values: ClaimDraftValues, mode: "create" | "edit"): FieldErrors {
  const errors: FieldErrors = {};

  if (mode === "create" && !values.id.trim()) {
    errors.id = "Claim ID is required.";
  }
  if (!values.patientId.trim()) {
    errors.patientId = "Patient ID is required.";
  }
  if (!values.providerId.trim()) {
    errors.providerId = "Provider ID is required.";
  }
  if (!values.procedureCode.trim()) {
    errors.procedureCode = "Procedure code is required.";
  }
  if (!values.insuranceId.trim()) {
    errors.insuranceId = "Insurance ID is required.";
  }
  if (!values.amount.trim()) {
    errors.amount = "Amount is required.";
  } else if (Number.isNaN(Number(values.amount)) || Number(values.amount) < 0) {
    errors.amount = "Amount must be a valid non-negative number.";
  }

  return errors;
}

function Field({
  label,
  error,
  helperText,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  helperText?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 disabled:bg-slate-100 disabled:text-slate-500"
      />
      {error ? <span className="text-xs text-rose-700">{error}</span> : null}
      {!error && helperText ? <span className="text-xs text-slate-500">{helperText}</span> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  error,
  options,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  error?: string;
  options: readonly string[];
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}

export default ClaimForm;
