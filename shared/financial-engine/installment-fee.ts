import { FinancialEngineError } from "./errors.ts";
import { roundMoney, toDecimal } from "./money.ts";

export type InstallmentFeeType =
  | "none"
  | "fixed"
  | "percentage_of_requested_amount";

export type ResolveInstallmentFeeInput = {
  requestedAmount: number;
  /** Preferito se presente. */
  installmentFeeType?: InstallmentFeeType;
  installmentFeeValue?: number;
  /**
   * Legacy: spesa fissa in euro/rata.
   * Usata quando installmentFeeType è assente.
   */
  collectionFeePerInstallment?: number;
};

export type ResolvedInstallmentFee = {
  installmentFeeType: InstallmentFeeType;
  installmentFeeValue: number;
  /** Importo in euro applicato a ogni rata. */
  feePerInstallment: number;
};

/**
 * Risolve la spesa/commissione per rata in euro.
 * Retrocompatibile: senza type → interpreta collectionFeePerInstallment come fixed.
 */
export function resolveInstallmentFee(
  input: ResolveInstallmentFeeInput,
): ResolvedInstallmentFee {
  const { requestedAmount } = input;

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw new FinancialEngineError(
      "INVALID_REQUESTED_AMOUNT",
      "L'importo richiesto deve essere maggiore di zero.",
    );
  }

  if (input.installmentFeeType === undefined) {
    const legacy = input.collectionFeePerInstallment ?? 0;
    if (!Number.isFinite(legacy) || legacy < 0) {
      throw new FinancialEngineError(
        "INVALID_COLLECTION_FEE",
        "La spesa di incasso rata non può essere negativa.",
      );
    }
    const fee = roundMoney(legacy);
    return {
      installmentFeeType: fee === 0 ? "none" : "fixed",
      installmentFeeValue: fee,
      feePerInstallment: fee,
    };
  }

  const type = input.installmentFeeType;
  const value = input.installmentFeeValue ?? 0;

  if (!Number.isFinite(value) || value < 0) {
    throw new FinancialEngineError(
      "INVALID_COLLECTION_FEE",
      "Il valore della spesa/commissione per rata non può essere negativo.",
    );
  }

  if (type === "none") {
    if (value !== 0) {
      throw new FinancialEngineError(
        "INVALID_COLLECTION_FEE",
        "Con spesa/commissione assente il valore deve essere zero.",
      );
    }
    return {
      installmentFeeType: "none",
      installmentFeeValue: 0,
      feePerInstallment: 0,
    };
  }

  if (type === "fixed") {
    const fee = roundMoney(value);
    return {
      installmentFeeType: "fixed",
      installmentFeeValue: fee,
      feePerInstallment: fee,
    };
  }

  // percentage_of_requested_amount — costante su tutte le rate, sull'importo richiesto.
  const fee = roundMoney(toDecimal(requestedAmount).mul(value).div(100));
  return {
    installmentFeeType: "percentage_of_requested_amount",
    installmentFeeValue: value,
    feePerInstallment: fee,
  };
}
