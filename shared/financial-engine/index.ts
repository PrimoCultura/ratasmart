export type {
  AllowedDurationsInput,
  AmortizationRow,
  CashFlow,
  FinancialCalculationInput,
  FinancialCalculationResult,
  OpeningFeeType,
  TaegCalculationResult,
  TaegErrorCode,
} from "./types.ts";

export { FinancialEngineError } from "./errors.ts";
export type { FinancialEngineErrorCode } from "./errors.ts";

export {
  Decimal,
  almostEqual,
  roundMoney,
  roundPercent,
  toDecimal,
} from "./money.ts";

export {
  convertDelayDaysToMonths,
  generateAllowedDurations,
} from "./durations.ts";

export {
  calculateFinancedAmount,
  calculateOpeningFee,
} from "./opening-fee.ts";

export { calculateFrenchInstallment } from "./installment.ts";
export type {
  FrenchInstallmentInput,
  FrenchInstallmentResult,
} from "./installment.ts";

export { buildFrenchAmortizationSchedule } from "./amortization.ts";
export type {
  AmortizationBuildResult,
  AmortizationInput,
} from "./amortization.ts";

export { calculateInternalCost } from "./internal-cost.ts";
export type { InternalCostInput, InternalCostResult } from "./internal-cost.ts";

export {
  buildPatientCashFlows,
  estimateTechnicalTaeg,
} from "./taeg.ts";

export { calculateFinancialSolution } from "./solution.ts";

export { FINANCIAL_ENGINE_VERSION } from "./version.ts";
