export const PRODUCT_CATEGORIES = [
  "standard",
  "zero_interest",
  "subsidized",
  "small_amount",
  "special",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  standard: "Tasso standard",
  zero_interest: "Tasso zero",
  subsidized: "Tasso agevolato",
  small_amount: "Piccoli importi",
  special: "Prodotto speciale",
};

export const OPENING_FEE_TYPES = ["none", "fixed", "percentage"] as const;
export type OpeningFeeType = (typeof OPENING_FEE_TYPES)[number];

export const OPENING_FEE_TYPE_LABELS: Record<OpeningFeeType, string> = {
  none: "Nessuna",
  fixed: "Fissa (€)",
  percentage: "Percentuale (%)",
};

export const EMPLOYMENT_TYPES = [
  "permanent_employee",
  "temporary_employee",
  "pensioner",
  "self_employed",
  "unemployed",
  "other",
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  permanent_employee: "Dipendente tempo indeterminato",
  temporary_employee: "Dipendente tempo determinato",
  pensioner: "Pensionato",
  self_employed: "Autonomo / Partita IVA",
  unemployed: "Disoccupato",
  other: "Altro",
};

export const POLICY_RULE_TYPES = [
  "minimum_age",
  "maximum_age_at_application",
  "maximum_age_at_end",
  "employment_type_allowed",
  "temporary_contract_expiry",
  "pensioner_allowed",
  "non_eu_allowed",
  "residence_permit_expiry",
  "minimum_amount",
  "maximum_amount",
  "minimum_duration",
  "maximum_duration",
  "custom",
] as const;

export type PolicyRuleType = (typeof POLICY_RULE_TYPES)[number];

export const POLICY_RULE_TYPE_LABELS: Record<PolicyRuleType, string> = {
  minimum_age: "Età minima",
  maximum_age_at_application: "Età massima alla richiesta",
  maximum_age_at_end: "Età massima a fine finanziamento",
  employment_type_allowed: "Tipologie di lavoro ammesse",
  temporary_contract_expiry: "Scadenza contratto determinato",
  pensioner_allowed: "Pensionato ammesso",
  non_eu_allowed: "Extracomunitario ammesso",
  residence_permit_expiry: "Scadenza permesso di soggiorno",
  minimum_amount: "Importo minimo",
  maximum_amount: "Importo massimo",
  minimum_duration: "Durata minima",
  maximum_duration: "Durata massima",
  custom: "Regola personalizzata",
};

export const POLICY_OPERATORS = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "in",
  "not_in",
  "date_after_financing_end",
  "date_after_application",
  "custom",
] as const;

export type PolicyOperator = (typeof POLICY_OPERATORS)[number];

export const POLICY_OPERATOR_LABELS: Record<PolicyOperator, string> = {
  equals: "Uguale a",
  not_equals: "Diverso da",
  greater_than: "Maggiore di",
  greater_than_or_equal: "Maggiore o uguale a",
  less_than: "Minore di",
  less_than_or_equal: "Minore o uguale a",
  in: "In elenco",
  not_in: "Non in elenco",
  date_after_financing_end: "Data dopo fine finanziamento",
  date_after_application: "Data dopo la richiesta",
  custom: "Personalizzato",
};

export const MESSAGE_TYPES = ["positive", "warning", "information"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  positive: "Positivo",
  warning: "Avviso",
  information: "Informazione",
};

export const ICON_TYPES = ["plus", "exclamation", "info"] as const;
export type IconType = (typeof ICON_TYPES)[number];

export const ICON_TYPE_LABELS: Record<IconType, string> = {
  plus: "Più (positivo)",
  exclamation: "Punto esclamativo",
  info: "Informazione",
};

export const COMMON_FIRST_INSTALLMENT_DELAYS = [30, 60, 90] as const;

export function defaultRequiresManagerAuthorization(
  category: ProductCategory,
): boolean {
  return category === "zero_interest" || category === "subsidized";
}

/**
 * Genera le durate disponibili da minimo, massimo e step.
 * Esempio: 12–84 step 6 → 12, 18, 24…84
 */
export function generateDurationMonths(
  minimum: number,
  maximum: number,
  step: number,
): number[] {
  if (
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    !Number.isFinite(step) ||
    minimum <= 0 ||
    maximum < minimum ||
    step <= 0
  ) {
    return [];
  }
  const durations: number[] = [];
  for (let current = minimum; current <= maximum; current += step) {
    durations.push(current);
  }
  return durations;
}
