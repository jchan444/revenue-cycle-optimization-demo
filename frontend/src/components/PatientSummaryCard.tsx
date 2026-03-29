import React from "react";
import { PatientSummary } from "../types/claim";

interface PatientSummaryCardProps {
  patient: PatientSummary;
}

function PatientSummaryCard({ patient }: PatientSummaryCardProps) {
  return (
    <section
      tabIndex={0}
      aria-label="Patient summary"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Patient Summary</h2>
      <dl className="grid gap-2 text-sm text-slate-900">
        <div>
          <dt className="font-medium">Name</dt>
          <dd>{patient.name}</dd>
        </div>
        <div>
          <dt className="font-medium">Age</dt>
          <dd>{patient.age}</dd>
        </div>
        <div>
          <dt className="font-medium">Gender</dt>
          <dd className="capitalize">{patient.gender}</dd>
        </div>
        <div>
          <dt className="font-medium">Primary Condition</dt>
          <dd>{patient.primaryCondition}</dd>
        </div>
      </dl>
    </section>
  );
}

export default PatientSummaryCard;
