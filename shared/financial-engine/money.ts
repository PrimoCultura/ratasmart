import Decimal from "decimal.js";
import { FinancialEngineError } from "./errors.ts";

/** Alta precisione nei calcoli intermedi. */
Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

export { Decimal };

export function toDecimal(value: number | string | Decimal): Decimal {
  if (value instanceof Decimal) {
    if (!value.isFinite()) {
      throw new FinancialEngineError(
        "INVALID_NUMERIC_VALUE",
        "Valore Decimal non finito.",
      );
    }
    return value;
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new FinancialEngineError(
      "INVALID_NUMERIC_VALUE",
      "Valore numerico non finito (NaN o Infinity).",
    );
  }

  try {
    const decimal = new Decimal(value);
    if (!decimal.isFinite()) {
      throw new FinancialEngineError(
        "INVALID_NUMERIC_VALUE",
        "Valore Decimal non finito.",
      );
    }
    return decimal;
  } catch (error) {
    if (error instanceof FinancialEngineError) {
      throw error;
    }
    throw new FinancialEngineError(
      "INVALID_NUMERIC_VALUE",
      "Impossibile convertire il valore in Decimal.",
    );
  }
}

/** Arrotondamento monetario a 2 decimali (ROUND_HALF_UP). */
export function roundMoney(value: number | string | Decimal): number {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/** Arrotondamento percentuale con precisione configurabile (default 8). */
export function roundPercent(
  value: number | string | Decimal,
  decimals = 8,
): number {
  return toDecimal(value)
    .toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
    .toNumber();
}

export function assertNonNegativeMoney(
  value: number,
  code: FinancialEngineError["code"],
  message: string,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new FinancialEngineError(code, message);
  }
}

export function almostEqual(
  left: number,
  right: number,
  tolerance = 0.01,
): boolean {
  return Math.abs(left - right) <= tolerance;
}
