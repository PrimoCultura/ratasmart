import { FinancialEngineError } from "./errors.ts";
import { roundMoney, toDecimal } from "./money.ts";
import type { OpeningFeeType } from "./types.ts";

export type OpeningFeeInput = {
  requestedAmount: number;
  openingFeeType: OpeningFeeType;
  openingFeeValue: number;
};

/**
 * Calcola la commissione di apertura.
 * La commissione viene finanziata: financedAmount = requestedAmount + openingFee.
 */
export function calculateOpeningFee(input: OpeningFeeInput): number {
  const { requestedAmount, openingFeeType, openingFeeValue } = input;

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw new FinancialEngineError(
      "INVALID_REQUESTED_AMOUNT",
      "L'importo richiesto deve essere un numero finito maggiore di zero.",
    );
  }

  if (!Number.isFinite(openingFeeValue) || openingFeeValue < 0) {
    throw new FinancialEngineError(
      "INVALID_OPENING_FEE",
      "Il valore della commissione di apertura non può essere negativo.",
    );
  }

  switch (openingFeeType) {
    case "none": {
      if (openingFeeValue !== 0) {
        throw new FinancialEngineError(
          "INVALID_OPENING_FEE",
          "Con commissione assente il valore deve essere zero.",
        );
      }
      return 0;
    }
    case "fixed":
      return roundMoney(openingFeeValue);
    case "percentage": {
      const fee = toDecimal(requestedAmount)
        .mul(toDecimal(openingFeeValue))
        .div(100);
      return roundMoney(fee);
    }
    default: {
      const _exhaustive: never = openingFeeType;
      throw new FinancialEngineError(
        "INVALID_OPENING_FEE",
        `Tipo commissione non supportato: ${String(_exhaustive)}`,
      );
    }
  }
}

export function calculateFinancedAmount(
  requestedAmount: number,
  openingFeeAmount: number,
): number {
  return roundMoney(toDecimal(requestedAmount).plus(openingFeeAmount));
}
