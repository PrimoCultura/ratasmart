import { FinancialEngineError } from "./errors.ts";
import { Decimal, roundMoney, toDecimal } from "./money.ts";

export type FrenchInstallmentInput = {
  financedAmount: number;
  customerTanPercent: number;
  durationMonths: number;
};

export type FrenchInstallmentResult = {
  monthlyRate: number;
  theoreticalInstallment: number;
  roundedRegularInstallment: number;
};

/**
 * Calcola la rata base alla francese (senza spesa di incasso).
 *
 * TAN > 0:
 *   installment = P * r / (1 - (1+r)^(-n))
 * TAN = 0:
 *   installment = P / n
 */
export function calculateFrenchInstallment(
  input: FrenchInstallmentInput,
): FrenchInstallmentResult {
  const { financedAmount, customerTanPercent, durationMonths } = input;

  if (!Number.isFinite(financedAmount) || financedAmount <= 0) {
    throw new FinancialEngineError(
      "INVALID_REQUESTED_AMOUNT",
      "L'importo finanziato deve essere maggiore di zero.",
    );
  }

  if (!Number.isFinite(customerTanPercent) || customerTanPercent < 0) {
    throw new FinancialEngineError(
      "INVALID_TAN",
      "Il TAN paziente non può essere negativo.",
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

  const principal = toDecimal(financedAmount);

  if (customerTanPercent === 0) {
    const theoretical = principal.div(durationMonths);
    return {
      monthlyRate: 0,
      theoreticalInstallment: theoretical.toNumber(),
      roundedRegularInstallment: roundMoney(theoretical),
    };
  }

  const monthlyRate = toDecimal(customerTanPercent).div(100).div(12);
  const onePlusR = new Decimal(1).plus(monthlyRate);
  const denominator = new Decimal(1).minus(onePlusR.pow(-durationMonths));

  if (denominator.isZero()) {
    throw new FinancialEngineError(
      "INVALID_TAN",
      "Denominatore della formula francese nullo.",
    );
  }

  const theoretical = principal.mul(monthlyRate).div(denominator);

  return {
    monthlyRate: monthlyRate.toNumber(),
    theoreticalInstallment: theoretical.toNumber(),
    roundedRegularInstallment: roundMoney(theoretical),
  };
}
