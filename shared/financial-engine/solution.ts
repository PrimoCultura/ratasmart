import { buildFrenchAmortizationSchedule } from "./amortization.ts";
import { FinancialEngineError } from "./errors.ts";
import { calculateInternalCost } from "./internal-cost.ts";
import { resolveInstallmentFee } from "./installment-fee.ts";
import { Decimal, roundMoney, toDecimal } from "./money.ts";
import {
  calculateFinancedAmount,
  calculateOpeningFee,
} from "./opening-fee.ts";
import { estimateTechnicalTaeg } from "./taeg.ts";
import type {
  FinancialCalculationInput,
  FinancialCalculationResult,
} from "./types.ts";

function validateInput(input: FinancialCalculationInput): void {
  if (!Number.isFinite(input.requestedAmount) || input.requestedAmount <= 0) {
    throw new FinancialEngineError(
      "INVALID_REQUESTED_AMOUNT",
      "L'importo richiesto deve essere un numero finito maggiore di zero.",
    );
  }

  if (
    !Number.isFinite(input.durationMonths) ||
    !Number.isInteger(input.durationMonths) ||
    input.durationMonths <= 0
  ) {
    throw new FinancialEngineError(
      "INVALID_DURATION",
      "La durata deve essere un intero maggiore di zero.",
    );
  }

  if (!Number.isFinite(input.customerTanPercent) || input.customerTanPercent < 0) {
    throw new FinancialEngineError(
      "INVALID_TAN",
      "Il TAN paziente non può essere negativo.",
    );
  }

  if (!Number.isFinite(input.openingFeeValue) || input.openingFeeValue < 0) {
    throw new FinancialEngineError(
      "INVALID_OPENING_FEE",
      "Il valore della commissione di apertura non può essere negativo.",
    );
  }

  if (
    input.collectionFeePerInstallment !== undefined &&
    (!Number.isFinite(input.collectionFeePerInstallment) ||
      input.collectionFeePerInstallment < 0)
  ) {
    throw new FinancialEngineError(
      "INVALID_COLLECTION_FEE",
      "La spesa di incasso rata non può essere negativa.",
    );
  }

  if (
    input.installmentFeeValue !== undefined &&
    (!Number.isFinite(input.installmentFeeValue) ||
      input.installmentFeeValue < 0)
  ) {
    throw new FinancialEngineError(
      "INVALID_COLLECTION_FEE",
      "Il valore della spesa/commissione per rata non può essere negativo.",
    );
  }

  if (
    input.internalCostPercentApplied !== undefined &&
    (!Number.isFinite(input.internalCostPercentApplied) ||
      input.internalCostPercentApplied < 0)
  ) {
    throw new FinancialEngineError(
      "INVALID_INTERNAL_COST",
      "Il costo interno applicato non può essere negativo.",
    );
  }

  if (
    input.internalCostPercentAt24Months !== undefined &&
    (!Number.isFinite(input.internalCostPercentAt24Months) ||
      input.internalCostPercentAt24Months < 0)
  ) {
    throw new FinancialEngineError(
      "INVALID_INTERNAL_COST",
      "Il costo interno a 24 mesi non può essere negativo.",
    );
  }
}

/**
 * Motore aggregatore: calcola la soluzione finanziaria completa.
 * Funzione pura, senza I/O, React o Convex.
 */
export function calculateFinancialSolution(
  input: FinancialCalculationInput,
): FinancialCalculationResult {
  validateInput(input);

  const openingFeeAmount = calculateOpeningFee({
    requestedAmount: input.requestedAmount,
    openingFeeType: input.openingFeeType,
    openingFeeValue: input.openingFeeValue,
  });

  const financedAmount = calculateFinancedAmount(
    input.requestedAmount,
    openingFeeAmount,
  );

  const installmentFee = resolveInstallmentFee({
    requestedAmount: input.requestedAmount,
    installmentFeeType: input.installmentFeeType,
    installmentFeeValue: input.installmentFeeValue,
    collectionFeePerInstallment: input.collectionFeePerInstallment,
  });

  const amortization = buildFrenchAmortizationSchedule({
    financedAmount,
    customerTanPercent: input.customerTanPercent,
    durationMonths: input.durationMonths,
    collectionFeePerInstallment: installmentFee.feePerInstallment,
    firstInstallmentDelayDays: input.firstInstallmentDelayDays,
  });

  const schedule = amortization.schedule;

  const totalPrincipalRepaid = roundMoney(
    schedule.reduce(
      (sum, row) => sum.plus(row.principalAmount),
      new Decimal(0),
    ),
  );
  const totalCustomerInterest = roundMoney(
    schedule.reduce(
      (sum, row) => sum.plus(row.interestAmount),
      new Decimal(0),
    ),
  );
  const totalCollectionFees = roundMoney(
    schedule.reduce(
      (sum, row) => sum.plus(row.collectionFeeAmount),
      new Decimal(0),
    ),
  );
  const totalCustomerRepayment = roundMoney(
    schedule.reduce(
      (sum, row) => sum.plus(row.totalInstallmentAmount),
      new Decimal(0),
    ),
  );
  const totalCustomerCosts = roundMoney(
    toDecimal(totalCustomerRepayment).minus(input.requestedAmount),
  );

  const internal = calculateInternalCost({
    requestedAmount: input.requestedAmount,
    financedAmount,
    durationMonths: input.durationMonths,
    internalCostBase: input.internalCostBase,
    internalCostPercentApplied: input.internalCostPercentApplied,
    internalCostPercentAt24Months: input.internalCostPercentAt24Months,
  });

  const estimatedTaeg = estimateTechnicalTaeg({
    requestedAmount: input.requestedAmount,
    schedule,
  });

  const regularTotalInstallmentAmount = roundMoney(
    toDecimal(amortization.regularBaseInstallmentAmount).plus(
      installmentFee.feePerInstallment,
    ),
  );
  const finalRow = schedule[schedule.length - 1];
  const finalTotalInstallmentAmount = finalRow?.totalInstallmentAmount ?? 0;

  return {
    requestedAmount: roundMoney(input.requestedAmount),
    openingFeeAmount,
    financedAmount,
    durationMonths: input.durationMonths,
    firstInstallmentDelayDays: input.firstInstallmentDelayDays,
    customerTanPercent: input.customerTanPercent,
    monthlyNominalRate: amortization.monthlyRate,
    theoreticalBaseInstallmentAmount: amortization.theoreticalBaseInstallmentAmount,
    regularBaseInstallmentAmount: amortization.regularBaseInstallmentAmount,
    installmentFeeType: installmentFee.installmentFeeType,
    installmentFeeValue: installmentFee.installmentFeeValue,
    collectionFeePerInstallment: installmentFee.feePerInstallment,
    regularTotalInstallmentAmount,
    finalTotalInstallmentAmount,
    totalPrincipalRepaid,
    totalCustomerInterest,
    totalCollectionFees,
    totalCustomerRepayment,
    totalCustomerCosts,
    internalCostBase: internal.internalCostBase,
    internalCostPercentAt24Months: internal.internalCostPercentAt24Months,
    internalCostPercentApplied: internal.internalCostPercentApplied,
    internalCostAmount: internal.internalCostAmount,
    netAmountPaidToCompany: internal.netAmountPaidToCompany,
    estimatedTaeg,
    amortizationSchedule: schedule,
    warnings: [
      "Il calcolo non include eventuali oneri fiscali applicabili alla prima rata.",
      "Il TAEG prodotto è una stima tecnica e non un TAEG contrattuale definitivo.",
    ],
  };
}
