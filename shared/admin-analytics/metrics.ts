/**
 * Analytics admin deterministiche (senza LLM).
 * Pure functions: testabili e riusabili da Convex query.
 */

export type ComparisonOutcomeClass =
  | "compatible"
  | "verification_required"
  | "no_solution";

export type ProblemMacroCategory =
  | "PRODUCT_GAP"
  | "PATIENT_ELIGIBILITY"
  | "MISSING_INFORMATION"
  | "NETWORK_AVAILABILITY"
  | "OTHER";

export type SimulationDeletionReason =
  | "data_entry_error"
  | "test"
  | "duplicate"
  | "user_request"
  | "other";

export const SIMULATION_DELETION_REASON_LABELS: Record<
  SimulationDeletionReason,
  string
> = {
  data_entry_error: "Errore di inserimento",
  test: "Test",
  duplicate: "Duplicata",
  user_request: "Richiesta utente",
  other: "Altro",
};

export function isSimulationSoftDeleted(simulation: {
  deletedAt?: number;
}): boolean {
  return simulation.deletedAt !== undefined && Number.isFinite(simulation.deletedAt);
}

export function classifyComparisonOutcome(input: {
  compatibleSolutionsCount: number;
  verificationRequiredSolutionsCount: number;
}): ComparisonOutcomeClass {
  if (input.compatibleSolutionsCount > 0) return "compatible";
  if (input.verificationRequiredSolutionsCount > 0) {
    return "verification_required";
  }
  return "no_solution";
}

export function coverageRate(input: {
  withCompatible: number;
  withValidComparison: number;
}): number | null {
  if (input.withValidComparison <= 0) return null;
  return input.withCompatible / input.withValidComparison;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

/** Mediana su array di numeri (copia ordinata). */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function percent(part: number, total: number): number | null {
  if (total <= 0) return null;
  return part / total;
}

export function classifyRuleTypeToMacro(
  ruleType: string,
): ProblemMacroCategory {
  switch (ruleType) {
    case "minimum_amount":
    case "maximum_amount":
    case "maximum_amount_for_employment_types":
    case "minimum_duration":
    case "maximum_duration":
      return "PRODUCT_GAP";
    case "minimum_age":
    case "maximum_age_at_application":
    case "maximum_age_at_end":
    case "precise_age_at_application_range":
    case "employment_type_allowed":
    case "pensioner_allowed":
    case "minimum_employment_seniority_months":
    case "temporary_contract_expiry":
    case "residence_permit_expiry":
    case "renewal_receipt_allowed":
    case "non_eu_allowed":
    case "guarantor_required_for_employment_types":
      return "PATIENT_ELIGIBILITY";
    case "missing_birth_date":
    case "missing_employment_start_date":
    case "missing_patient_data":
      return "MISSING_INFORMATION";
    case "product_not_available_on_network":
    case "network_unavailable":
    case "table_not_available_on_network":
      return "NETWORK_AVAILABILITY";
    default:
      return "OTHER";
  }
}

/** Mappa ruleType → label operativa per aggregazione top motivi. */
export function reasonLabelForRuleType(ruleType: string): string {
  switch (ruleType) {
    case "minimum_age":
    case "maximum_age_at_application":
    case "maximum_age_at_end":
    case "precise_age_at_application_range":
      return "Età";
    case "minimum_amount":
    case "maximum_amount":
    case "maximum_amount_for_employment_types":
      return "Importo min/max";
    case "minimum_duration":
    case "maximum_duration":
      return "Durata";
    case "employment_type_allowed":
    case "pensioner_allowed":
      return "Contratto / condizione lavorativa";
    case "minimum_employment_seniority_months":
      return "Anzianità lavorativa";
    case "temporary_contract_expiry":
      return "Scadenza contratto";
    case "residence_permit_expiry":
    case "renewal_receipt_allowed":
    case "non_eu_allowed":
      return "Permesso di soggiorno";
    case "guarantor_required_for_employment_types":
      return "Garante";
    case "missing_birth_date":
    case "missing_employment_start_date":
    case "missing_patient_data":
      return "Dato mancante";
    case "product_not_available_on_network":
    case "network_unavailable":
    case "table_not_available_on_network":
      return "Disponibilità rete/prodotto";
    default:
      return ruleType || "Altro";
  }
}

export type TrendBucketGranularity = "day" | "week" | "month";

export function chooseTrendGranularity(
  fromMs: number,
  toMs: number,
): TrendBucketGranularity {
  const days = Math.max(1, (toMs - fromMs) / (24 * 60 * 60 * 1000));
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
}

export function trendBucketKey(
  timestamp: number,
  granularity: TrendBucketGranularity,
): string {
  const date = new Date(timestamp);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  if (granularity === "day") return `${y}-${m}-${d}`;
  if (granularity === "month") return `${y}-${m}`;
  // ISO week-ish: use Monday UTC of the week
  const day = date.getUTCDay() || 7;
  const monday = new Date(
    Date.UTC(y, date.getUTCMonth(), date.getUTCDate() - (day - 1)),
  );
  const wy = monday.getUTCFullYear();
  const wm = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const wd = String(monday.getUTCDate()).padStart(2, "0");
  return `${wy}-${wm}-${wd}`;
}

export function inPeriod(
  timestamp: number,
  fromMs: number,
  toMs: number,
): boolean {
  return timestamp >= fromMs && timestamp <= toMs;
}

export function formatPercent(ratio: number | null, digits = 1): string {
  if (ratio === null || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}
