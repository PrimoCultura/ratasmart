import { FinancialEngineError } from "./errors.ts";
import { roundMoney, roundPercent, toDecimal } from "./money.ts";

export type InternalCostInput = {
  financedAmount: number;
  durationMonths: number;
  internalCostPercentAt24Months?: number;
};

export type InternalCostResult = {
  internalCostPercentAt24Months: number;
  internalCostPercentApplied: number;
  internalCostAmount: number;
  netAmountPaidToCompany: number;
};

/**
 * Costo interno aziendale proporzionale alla durata.
 *
 * applied% = percentAt24 × durationMonths / 24
 * amount = financedAmount × applied% / 100
 * netto = financedAmount − amount
 *
 * Non entra in rata, TAN o TAEG paziente.
 */
export function calculateInternalCost(
  input: InternalCostInput,
): InternalCostResult {
  const { financedAmount, durationMonths, internalCostPercentAt24Months } =
    input;

  if (!Number.isFinite(financedAmount) || financedAmount <= 0) {
    throw new FinancialEngineError(
      "INVALID_REQUESTED_AMOUNT",
      "L'importo finanziato deve essere maggiore di zero.",
    );
  }

  if (
    !Number.isFinite(durationMonths) ||
    !Number.isInteger(durationMonths) ||
    durationMonths <= 0
  ) {
    throw new FinancialEngineError(
      "INVALID_DURATION",
      "La durata deve essere un intero maggiore di zero.",
    );
  }

  if (
    internalCostPercentAt24Months === undefined ||
    internalCostPercentAt24Months === 0
  ) {
    return {
      internalCostPercentAt24Months: 0,
      internalCostPercentApplied: 0,
      internalCostAmount: 0,
      netAmountPaidToCompany: roundMoney(financedAmount),
    };
  }

  if (
    !Number.isFinite(internalCostPercentAt24Months) ||
    internalCostPercentAt24Months < 0
  ) {
    throw new FinancialEngineError(
      "INVALID_INTERNAL_COST",
      "Il costo interno a 24 mesi non può essere negativo.",
    );
  }

  const applied = toDecimal(internalCostPercentAt24Months)
    .mul(durationMonths)
    .div(24);
  const amount = toDecimal(financedAmount).mul(applied).div(100);
  const costAmount = roundMoney(amount);
  const net = roundMoney(toDecimal(financedAmount).minus(costAmount));

  return {
    internalCostPercentAt24Months: roundPercent(internalCostPercentAt24Months, 8),
    internalCostPercentApplied: roundPercent(applied, 8),
    internalCostAmount: costAmount,
    netAmountPaidToCompany: net,
  };
}
