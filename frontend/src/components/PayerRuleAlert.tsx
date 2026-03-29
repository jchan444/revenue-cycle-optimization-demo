import React from "react";

interface PayerRuleAlertProps {
  status?: "aligned" | "violated";
  message?: string;
}

function PayerRuleAlert({ status, message }: PayerRuleAlertProps) {
  if (!status) {
    return (
      <span className="inline-flex rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-900">
        Rule unknown
      </span>
    );
  }

  const isAligned = status === "aligned";
  const classes = isAligned
    ? "bg-emerald-700 text-white"
    : "bg-rose-700 text-white";

  return (
    <span
      tabIndex={0}
      role="status"
      aria-label={message ?? `Payer rule is ${status}`}
      className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${classes}`}
    >
      {isAligned ? "Rule aligned" : "Rule violation"}
    </span>
  );
}

export default PayerRuleAlert;
