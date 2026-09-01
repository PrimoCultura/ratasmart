import { v } from "convex/values";

export const networkValidator = v.union(v.literal("PCG"), v.literal("DES"));

export const productCategoryValidator = v.union(
  v.literal("standard"),
  v.literal("zero_interest"),
  v.literal("subsidized"),
  v.literal("small_amount"),
  v.literal("special"),
);

export const openingFeeTypeValidator = v.union(
  v.literal("none"),
  v.literal("fixed"),
  v.literal("percentage"),
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
  v.literal("minimum_amount"),
  v.literal("maximum_amount"),
  v.literal("minimum_duration"),
  v.literal("maximum_duration"),
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
  | "special";

export function defaultRequiresManagerAuthorization(
  category: ProductCategory,
): boolean {
  return category === "zero_interest" || category === "subsidized";
}

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
  internalCostPercentAt24Months?: number;
  firstInstallmentDelayDays: number[];
};

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
    input.internalCostPercentAt24Months !== undefined &&
    input.internalCostPercentAt24Months < 0
  ) {
    throw new Error("Il costo interno a 24 mesi non può essere negativo.");
  }
  if (input.firstInstallmentDelayDays.length === 0) {
    throw new Error("Indica almeno un ritardo per la prima rata.");
  }
  if (input.firstInstallmentDelayDays.some((day) => day <= 0)) {
    throw new Error("I giorni di ritardo della prima rata devono essere positivi.");
  }
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
