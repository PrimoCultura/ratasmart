import { FinancialEngineError } from "./errors.ts";
import { roundMoney, roundPercent, toDecimal } from "./money.ts";

export type InternalCostBase = "requested_amount" | "financed_amount";

export type InternalCostInput = {
  /** Importo richiesto/prestazione (base del netto liquidato alla clinica). */
  requestedAmount: number;
  /** Importo finanziato al paziente. */
  financedAmount: number;
  durationMonths: number;
  /**
   * Base % costo aziendale.
   * Default legacy: financed_amount (Agos e tabelle precedenti).
   */
  internalCostBase?: InternalCostBase;
  /** Costo aziendale esatto (preferito). */
  internalCostPercentApplied?: number;
  /** @deprecated Fallback proporzionale. */
  internalCostPercentAt24Months?: number;
};

export type InternalCostResult = {
  internalCostPercentAt24Months: number;
  internalCostPercentApplied: number;
  internalCostAmount: number;
  netAmountPaidToCompany: number;
  internalCostBase: InternalCostBase;
};

function assertPositiveMoney(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new FinancialEngineError(
      "INVALID_REQUESTED_AMOUNT",
      `${label} deve essere maggiore di zero.`,
    );
  }
}

function resolveCostBase(
  base: InternalCostBase | undefined,
): InternalCostBase {
  return base ?? "financed_amount";
}

function costBaseAmount(
  input: InternalCostInput,
  base: InternalCostBase,
): number {
  return base === "requested_amount"
    ? input.requestedAmount
    : input.financedAmount;
}

/**
 * Costo interno aziendale e netto liquidato alla clinica.
 *
 * internalCostAmount =
 *   costBase × applied% / 100
 *   costBase = requestedAmount | financedAmount (default legacy)
 *
 * netAmountPaidToCompany =
 *   requestedAmount − internalCostAmount
 *
 * Non entra in rata, TAN o TAEG paziente.
 */
export function calculateInternalCost(
  input: InternalCostInput,
): InternalCostResult {
  const {
    requestedAmount,
    financedAmount,
    durationMonths,
    internalCostPercentApplied,
    internalCostPercentAt24Months,
  } = input;

  assertPositiveMoney(requestedAmount, "L'importo richiesto");
  assertPositiveMoney(financedAmount, "L'importo finanziato");

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

  const internalCostBase = resolveCostBase(input.internalCostBase);
  const baseAmount = costBaseAmount(input, internalCostBase);

  const computeNet = (costAmount: number) =>
    roundMoney(toDecimal(requestedAmount).minus(costAmount));

  if (internalCostPercentApplied !== undefined) {
    if (
      !Number.isFinite(internalCostPercentApplied) ||
      internalCostPercentApplied < 0
    ) {
      throw new FinancialEngineError(
        "INVALID_INTERNAL_COST",
        "Il costo interno applicato non può essere negativo.",
      );
    }

    const amount = toDecimal(baseAmount)
      .mul(internalCostPercentApplied)
      .div(100);
    const costAmount = roundMoney(amount);

    return {
      internalCostPercentAt24Months: roundPercent(
        internalCostPercentAt24Months ?? 0,
        8,
      ),
      internalCostPercentApplied: roundPercent(internalCostPercentApplied, 8),
      internalCostAmount: costAmount,
      netAmountPaidToCompany: computeNet(costAmount),
      internalCostBase,
    };
  }

  if (
    internalCostPercentAt24Months === undefined ||
    internalCostPercentAt24Months === 0
  ) {
    return {
      internalCostPercentAt24Months: 0,
      internalCostPercentApplied: 0,
      internalCostAmount: 0,
      netAmountPaidToCompany: roundMoney(requestedAmount),
      internalCostBase,
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

  // LEGACY FALLBACK — proporzionale da 24 mesi.
  const applied = toDecimal(internalCostPercentAt24Months)
    .mul(durationMonths)
    .div(24);
  const amount = toDecimal(baseAmount).mul(applied).div(100);
  const costAmount = roundMoney(amount);

  return {
    internalCostPercentAt24Months: roundPercent(internalCostPercentAt24Months, 8),
    internalCostPercentApplied: roundPercent(applied, 8),
    internalCostAmount: costAmount,
    netAmountPaidToCompany: computeNet(costAmount),
    internalCostBase,
  };
}
