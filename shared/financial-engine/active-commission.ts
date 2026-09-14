import { FinancialEngineError } from "./errors.ts";
import { roundMoney, toDecimal } from "./money.ts";

export type ActiveCommissionBase = "requested_amount";

export type ActiveCommissionInput = {
  requestedAmount: number;
  activeCommissionPercent?: number;
  activeCommissionBase?: ActiveCommissionBase;
};

export type ActiveCommissionResult = {
  activeCommissionPercent: number;
  activeCommissionBase: ActiveCommissionBase | undefined;
  activeCommissionAmount: number;
};

/**
 * Provvigione attiva riconosciuta alla società sull'erogato/richiesto.
 * Non è costo aziendale e non modifica il totale paziente.
 */
export function calculateActiveCommission(
  input: ActiveCommissionInput,
): ActiveCommissionResult {
  const percent = input.activeCommissionPercent ?? 0;
  if (!Number.isFinite(percent) || percent < 0) {
    throw new FinancialEngineError(
      "INVALID_INTERNAL_COST",
      "La provvigione attiva non può essere negativa.",
    );
  }

  if (percent === 0) {
    return {
      activeCommissionPercent: 0,
      activeCommissionBase: input.activeCommissionBase,
      activeCommissionAmount: 0,
    };
  }

  const base = input.activeCommissionBase ?? "requested_amount";
  if (base !== "requested_amount") {
    throw new FinancialEngineError(
      "INVALID_INTERNAL_COST",
      "Base provvigione attiva non supportata.",
    );
  }

  const amount = roundMoney(
    toDecimal(input.requestedAmount).mul(percent).div(100),
  );

  return {
    activeCommissionPercent: percent,
    activeCommissionBase: base,
    activeCommissionAmount: amount,
  };
}
