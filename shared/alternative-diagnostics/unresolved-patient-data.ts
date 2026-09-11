import type { PatientFinancialProfile } from "../policy-engine/types.ts";
import type { FailedRuleSignal } from "./analyze-failure-reasons.ts";
import type { BlockingConstraint } from "./diagnostic-types.ts";

export const COMPLETE_EMPLOYMENT_START_DATE_MESSAGE =
  "Completa la data di assunzione per verificare l’anzianità lavorativa e ricalcolare le soluzioni disponibili.";

function needsEmploymentSeniority(patient: PatientFinancialProfile): boolean {
  return (
    patient.employmentType === "permanent_employee" ||
    patient.employmentType === "temporary_employee"
  );
}

/**
 * True se l’anzianità non è determinabile perché manca la data di assunzione
 * (e non c’è un fallback mesi legacy).
 */
export function isEmploymentSeniorityUndeterminable(
  patient: PatientFinancialProfile,
): boolean {
  if (!needsEmploymentSeniority(patient)) return false;
  const hasStartDate = Boolean(patient.employmentStartDate?.trim());
  const hasLegacyMonths =
    patient.employmentSeniorityMonths !== undefined &&
    patient.employmentSeniorityMonths !== null &&
    Number.isFinite(patient.employmentSeniorityMonths);
  return !hasStartDate && !hasLegacyMonths;
}

function messageIndicatesMissingEmploymentStart(message?: string): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("data di assunzione non indicata") ||
    normalized.includes("data di assunzione mancante") ||
    (normalized.includes("assunzione") &&
      (normalized.includes("non indicat") || normalized.includes("mancant")))
  );
}

/**
 * Blocker informativo/documentale: finché non è chiarito, cambiare durata/importo/prodotto
 * non rimuove il vincolo. Non generare alternative economiche.
 */
export function resolveUnresolvedPatientDataGuidance(input: {
  patient: PatientFinancialProfile;
  failedRules: FailedRuleSignal[];
  primaryConstraint?: BlockingConstraint;
}): {
  suppressesEconomicAlternatives: boolean;
  actionMessage?: string;
} {
  const seniorityRules = input.failedRules.filter(
    (item) => item.ruleType === "minimum_employment_seniority_months",
  );

  const undeterminable = isEmploymentSeniorityUndeterminable(input.patient);
  const missingStartFromRules = seniorityRules.some((item) =>
    messageIndicatesMissingEmploymentStart(item.message),
  );

  if (
    undeterminable &&
    (missingStartFromRules ||
      seniorityRules.length > 0 ||
      input.primaryConstraint?.type === "employment")
  ) {
    return {
      suppressesEconomicAlternatives: true,
      actionMessage: COMPLETE_EMPLOYMENT_START_DATE_MESSAGE,
    };
  }

  // Anche senza primary employment: se le regole dicono esplicitamente data mancante.
  if (missingStartFromRules && undeterminable) {
    return {
      suppressesEconomicAlternatives: true,
      actionMessage: COMPLETE_EMPLOYMENT_START_DATE_MESSAGE,
    };
  }

  return { suppressesEconomicAlternatives: false };
}
