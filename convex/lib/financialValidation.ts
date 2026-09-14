import { v } from "convex/values";

export const networkValidator = v.union(
  v.literal("PCG"),
  v.literal("DES"),
  v.literal("Paoleschi"),
);

export const productCategoryValidator = v.union(
  v.literal("standard"),
  v.literal("zero_interest"),
  v.literal("subsidized"),
  v.literal("small_amount"),
  v.literal("special"),
  v.literal("bnpl"),
);

export const openingFeeTypeValidator = v.union(
  v.literal("none"),
  v.literal("fixed"),
  v.literal("percentage"),
);

export const installmentFeeTypeValidator = v.union(
  v.literal("none"),
  v.literal("fixed"),
  v.literal("percentage_of_requested_amount"),
);

export const internalCostBaseValidator = v.union(
  v.literal("requested_amount"),
  v.literal("financed_amount"),
);

export const policyRuleTypeValidator = v.union(
  v.literal("minimum_age"),
  v.literal("maximum_age_at_application"),
  v.literal("maximum_age_at_end"),
  v.literal("employment_type_allowed"),
  v.literal("temporary_contract_expiry"),
  v.literal("pensioner_allowed"),
  v.literal("non_eu_allowed"),
  v.literal("residence_permit_expiry"),
  v.literal("renewal_receipt_allowed"),
  v.literal("minimum_employment_seniority_months"),
  v.literal("maximum_amount_for_employment_types"),
  v.literal("guarantor_required_for_employment_types"),
  v.literal("minimum_amount"),
  v.literal("maximum_amount"),
  v.literal("minimum_duration"),
  v.literal("maximum_duration"),
  v.literal("precise_age_at_application_range"),
  v.literal("custom"),
);

export const policyOperatorValidator = v.union(
  v.literal("equals"),
  v.literal("not_equals"),
  v.literal("greater_than"),
  v.literal("greater_than_or_equal"),
  v.literal("less_than"),
  v.literal("less_than_or_equal"),
  v.literal("in"),
  v.literal("not_in"),
  v.literal("date_after_financing_end"),
  v.literal("date_after_application"),
  v.literal("custom"),
);

export const messageTypeValidator = v.union(
  v.literal("positive"),
  v.literal("warning"),
  v.literal("information"),
);

export const iconTypeValidator = v.union(
  v.literal("plus"),
  v.literal("exclamation"),
  v.literal("info"),
);

export type ProductCategory =
  | "standard"
  | "zero_interest"
  | "subsidized"
  | "small_amount"
  | "special"
  | "bnpl";

export function defaultRequiresManagerAuthorization(
  category: ProductCategory,
): boolean {
  return category === "zero_interest" || category === "subsidized";
}

export type DurationTermInput = {
  durationMonths: number;
  minimumAmount: number;
  maximumAmount: number;
  customerTanPercent?: number;
  internalCostPercent?: number;
};

export type FinancialTableInput = {
  minimumAmount: number;
  maximumAmount: number;
  minimumDurationMonths: number;
  maximumDurationMonths: number;
  durationStepMonths: number;
  customerTanPercent: number;
  openingFeeType: "none" | "fixed" | "percentage";
  openingFeeValue: number;
  collectionFeePerInstallment: number;
  installmentFeeType?: "none" | "fixed" | "percentage_of_requested_amount";
  installmentFeeValue?: number;
  internalCostPercentAt24Months?: number;
  internalCostBase?: "requested_amount" | "financed_amount";
  firstInstallmentDelayDays: number[];
  durationTerms?: DurationTermInput[];
};

export function validateDurationTerms(
  terms: DurationTermInput[] | undefined,
): void {
  if (terms === undefined || terms.length === 0) {
    return;
  }

  const seen = new Set<number>();
  for (const term of terms) {
    if (
      !Number.isFinite(term.durationMonths) ||
      !Number.isInteger(term.durationMonths) ||
      term.durationMonths <= 0
    ) {
      throw new Error("Ogni durata deve essere un intero maggiore di zero.");
    }
    if (seen.has(term.durationMonths)) {
      throw new Error(
        `Durata duplicata nei termini: ${term.durationMonths} mesi.`,
      );
    }
    seen.add(term.durationMonths);
    if (!(term.minimumAmount > 0)) {
      throw new Error(
        `Importo minimo non valido per ${term.durationMonths} mesi.`,
      );
    }
    if (term.maximumAmount < term.minimumAmount) {
      throw new Error(
        `Importo massimo inferiore al minimo per ${term.durationMonths} mesi.`,
      );
    }
    if (
      term.customerTanPercent !== undefined &&
      term.customerTanPercent < 0
    ) {
      throw new Error(
        `TAN non valido per ${term.durationMonths} mesi.`,
      );
    }
    if (
      term.internalCostPercent !== undefined &&
      term.internalCostPercent < 0
    ) {
      throw new Error(
        `Costo aziendale non valido per ${term.durationMonths} mesi.`,
      );
    }
  }
}

export function validateFinancialTableEconomics(input: FinancialTableInput): void {
  if (input.minimumAmount <= 0) {
    throw new Error("L'importo minimo deve essere maggiore di zero.");
  }
  if (input.maximumAmount < input.minimumAmount) {
    throw new Error("L'importo massimo deve essere maggiore o uguale al minimo.");
  }
  if (input.minimumDurationMonths <= 0) {
    throw new Error("La durata minima deve essere maggiore di zero.");
  }
  if (input.maximumDurationMonths < input.minimumDurationMonths) {
    throw new Error("La durata massima deve essere maggiore o uguale alla minima.");
  }
  if (input.durationStepMonths <= 0) {
    throw new Error("Lo step durata deve essere maggiore di zero.");
  }
  if (input.customerTanPercent < 0) {
    throw new Error("Il TAN paziente non può essere negativo.");
  }
  if (input.openingFeeValue < 0) {
    throw new Error("Il valore della commissione di apertura non può essere negativo.");
  }
  if (input.openingFeeType === "none" && input.openingFeeValue !== 0) {
    throw new Error("Con commissione assente il valore deve essere zero.");
  }
  if (input.collectionFeePerInstallment < 0) {
    throw new Error("La spesa di incasso rata non può essere negativa.");
  }
  if (
    input.installmentFeeValue !== undefined &&
    input.installmentFeeValue < 0
  ) {
    throw new Error(
      "Il valore della spesa/commissione per rata non può essere negativo.",
    );
  }
  if (
    input.installmentFeeType === "none" &&
    (input.installmentFeeValue ?? 0) !== 0
  ) {
    throw new Error(
      "Con spesa/commissione per rata assente il valore deve essere zero.",
    );
  }
  if (
    input.internalCostPercentAt24Months !== undefined &&
    input.internalCostPercentAt24Months < 0
  ) {
    throw new Error("Il costo interno a 24 mesi non può essere negativo.");
  }
  if (
    input.internalCostBase !== undefined &&
    input.internalCostBase !== "requested_amount" &&
    input.internalCostBase !== "financed_amount"
  ) {
    throw new Error("Base costo aziendale non valida.");
  }
  if (input.firstInstallmentDelayDays.length === 0) {
    throw new Error("Indica almeno un ritardo per la prima rata.");
  }
  if (input.firstInstallmentDelayDays.some((day) => day <= 0)) {
    throw new Error("I giorni di ritardo della prima rata devono essere positivi.");
  }
  validateDurationTerms(input.durationTerms);
}

export function generateDurationMonths(
  minimum: number,
  maximum: number,
  step: number,
): number[] {
  if (minimum <= 0 || maximum < minimum || step <= 0) {
    return [];
  }
  const durations: number[] = [];
  for (let current = minimum; current <= maximum; current += step) {
    durations.push(current);
  }
  return durations;
}
