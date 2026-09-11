/**
 * Requisiti documentali operativi (non modificano ranking né compatibilità finanziaria).
 *
 * Soglia KB ufficiale PCG 2026 (`esenzione-documento-reddito`):
 * base = requestedAmount + spese finanziate (commissione di apertura).
 */

export const INCOME_DOCUMENT_THRESHOLD_EUR = 5000;

export type IncomeDocumentStatus =
  | "required"
  | "possible_exemption"
  | "requires_verification";

export type IncomeDocumentCompanyRequirement = {
  companyShortName: "Agos" | "Compass" | "Deutsche Bank";
  status: IncomeDocumentStatus;
  reason: string;
};

export type DocumentationRequirements = {
  incomeDocument: {
    status: IncomeDocumentStatus;
    reason: string;
    thresholdEur: number;
    /** Base usata: importo richiesto + spese finanziate. */
    thresholdBase: number;
    requestedAmount: number;
    financedFees: number;
    companies: IncomeDocumentCompanyRequirement[];
  };
};

export function resolveIncomeDocumentThresholdBase(input: {
  requestedAmount: number;
  financedFees: number;
}): number {
  const amount = Number.isFinite(input.requestedAmount)
    ? Math.max(0, input.requestedAmount)
    : 0;
  const fees = Number.isFinite(input.financedFees)
    ? Math.max(0, input.financedFees)
    : 0;
  return amount + fees;
}

/**
 * Valuta il documento di reddito secondo le indicazioni operative PCG.
 * Non produce compatible/not_compatible.
 */
export function evaluateIncomeDocumentRequirements(input: {
  requestedAmount: number;
  /** Spese finanziate (tipicamente opening fee). */
  financedFees: number;
  isNonEuCitizen: boolean;
}): DocumentationRequirements {
  const thresholdBase = resolveIncomeDocumentThresholdBase({
    requestedAmount: input.requestedAmount,
    financedFees: input.financedFees,
  });
  const withinThreshold = thresholdBase <= INCOME_DOCUMENT_THRESHOLD_EUR;

  const companies: IncomeDocumentCompanyRequirement[] = [
    {
      companyShortName: "Agos",
      status: withinThreshold ? "possible_exemption" : "required",
      reason: withinThreshold
        ? "Fino a €5.000 (importo + spese finanziate) Agos può prevedere esenzione dal documento di reddito (italiani e stranieri). L’esenzione non è garantita."
        : "Oltre €5.000 (importo + spese finanziate) il documento di reddito è richiesto secondo le indicazioni operative Agos.",
    },
    {
      companyShortName: "Compass",
      status: withinThreshold
        ? input.isNonEuCitizen
          ? "required"
          : "possible_exemption"
        : "required",
      reason: withinThreshold
        ? input.isNonEuCitizen
          ? "Per extracomunitari Compass richiede il documento di reddito anche sotto soglia €5.000."
          : "Fino a €5.000 (importo + spese finanziate) Compass può prevedere esenzione dal documento di reddito per cittadini italiani. L’esenzione non è garantita."
        : "Oltre €5.000 (importo + spese finanziate) il documento di reddito è richiesto secondo le indicazioni operative Compass.",
    },
    {
      companyShortName: "Deutsche Bank",
      status: withinThreshold
        ? input.isNonEuCitizen
          ? "required"
          : "possible_exemption"
        : "required",
      reason: withinThreshold
        ? input.isNonEuCitizen
          ? "Per extracomunitari Deutsche Bank richiede il documento di reddito anche sotto soglia €5.000."
          : "Fino a €5.000 (importo + spese finanziate) Deutsche Bank può prevedere esenzione dal documento di reddito per cittadini italiani. L’esenzione non è garantita."
        : "Oltre €5.000 (importo + spese finanziate) il documento di reddito è richiesto secondo le indicazioni operative Deutsche Bank.",
    },
  ];

  const hasRequired = companies.some((item) => item.status === "required");
  const hasExemption = companies.some(
    (item) => item.status === "possible_exemption",
  );
  const status: IncomeDocumentStatus = hasRequired
    ? hasExemption
      ? "requires_verification"
      : "required"
    : "possible_exemption";

  const reason = withinThreshold
    ? input.isNonEuCitizen
      ? "Importo complessivo entro €5.000: possibile esenzione Agos; Compass e Deutsche Bank richiedono documento di reddito per extracomunitario."
      : "Importo complessivo entro €5.000: possibile esenzione dal documento di reddito per Agos, Compass e Deutsche Bank (non garantita)."
    : "Importo complessivo (richiesto + spese finanziate) superiore a €5.000: documento di reddito richiesto secondo indicazioni operative.";

  return {
    incomeDocument: {
      status,
      reason,
      thresholdEur: INCOME_DOCUMENT_THRESHOLD_EUR,
      thresholdBase,
      requestedAmount: input.requestedAmount,
      financedFees: input.financedFees,
      companies,
    },
  };
}
