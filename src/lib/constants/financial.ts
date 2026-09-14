export const PRODUCT_CATEGORIES = [
  "standard",
  "zero_interest",
  "subsidized",
  "small_amount",
  "special",
  "bnpl",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  standard: "Tasso standard",
  zero_interest: "Tasso zero",
  subsidized: "Tasso agevolato",
  small_amount: "Piccoli importi",
  special: "Prodotto speciale",
  bnpl: "BNPL",
};

export const OPENING_FEE_TYPES = ["none", "fixed", "percentage"] as const;
export type OpeningFeeType = (typeof OPENING_FEE_TYPES)[number];

export const OPENING_FEE_TYPE_LABELS: Record<OpeningFeeType, string> = {
  none: "Nessuna",
  fixed: "Fissa (€)",
  percentage: "Percentuale (%)",
};

export const INSTALLMENT_FEE_TYPES = [
  "none",
  "fixed",
  "percentage_of_requested_amount",
] as const;
export type InstallmentFeeType = (typeof INSTALLMENT_FEE_TYPES)[number];

export const INSTALLMENT_FEE_TYPE_LABELS: Record<InstallmentFeeType, string> = {
  none: "Nessuna",
  fixed: "€ fisso/rata",
  percentage_of_requested_amount: "% importo richiesto/rata",
};

export const INTERNAL_COST_BASES = [
  "financed_amount",
  "requested_amount",
] as const;
export type InternalCostBase = (typeof INTERNAL_COST_BASES)[number];

export const INTERNAL_COST_BASE_LABELS: Record<InternalCostBase, string> = {
  financed_amount: "Su importo finanziato (legacy)",
  requested_amount: "Su importo richiesto",
};

export const EMPLOYMENT_TYPES = [
  "permanent_employee",
  "temporary_employee",
  "pensioner",
  "self_employed",
  "unemployed",
  "student",
  "housewife",
  "other",
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  permanent_employee: "Dipendente tempo indeterminato",
  temporary_employee: "Dipendente tempo determinato",
  pensioner: "Pensionato",
  self_employed: "Autonomo / Partita IVA",
  unemployed: "Disoccupato",
  student: "Studente",
  housewife: "Casalinga",
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
  "renewal_receipt_allowed",
  "minimum_employment_seniority_months",
  "maximum_amount_for_employment_types",
  "guarantor_required_for_employment_types",
  "minimum_amount",
  "maximum_amount",
  "minimum_duration",
  "maximum_duration",
  "precise_age_at_application_range",
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
  renewal_receipt_allowed: "Ricevuta di rinnovo permesso ammessa",
  minimum_employment_seniority_months: "Anzianità lavorativa minima (mesi)",
  maximum_amount_for_employment_types: "Importo massimo per tipologie di lavoro",
  guarantor_required_for_employment_types: "Garante richiesto per tipologie di lavoro",
  minimum_amount: "Importo minimo",
  maximum_amount: "Importo massimo",
  minimum_duration: "Durata minima",
  maximum_duration: "Durata massima",
  precise_age_at_application_range: "Range età preciso alla richiesta (Senior)",
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

export {
  generateDurationMonths,
  resolveTableDurationMonths,
  type DurationTermLike,
} from "../../../shared/table-durations";
