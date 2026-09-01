import { convertDelayDaysToMonths } from "./durations.ts";
import { FinancialEngineError } from "./errors.ts";
import { calculateFrenchInstallment } from "./installment.ts";
import { almostEqual, Decimal, roundMoney, toDecimal } from "./money.ts";
import type { AmortizationRow } from "./types.ts";

export type AmortizationInput = {
  financedAmount: number;
  customerTanPercent: number;
  durationMonths: number;
  collectionFeePerInstallment: number;
  firstInstallmentDelayDays: number;
};

export type AmortizationBuildResult = {
  monthlyRate: number;
  theoreticalBaseInstallmentAmount: number;
  regularBaseInstallmentAmount: number;
  schedule: AmortizationRow[];
};

/**
 * Costruisce il piano di ammortamento alla francese.
 *
 * Rate 1..n-1: rata regolare arrotondata; interessi arrotondati; capitale = differenza.
 * Ultima rata: capitale = saldo residuo; interessi sul saldo; rata base = somma.
 * Spesa di incasso aggiunta a ogni rata, senza generare interessi.
 */
export function buildFrenchAmortizationSchedule(
  input: AmortizationInput,
): AmortizationBuildResult {
  const {
    financedAmount,
    customerTanPercent,
    durationMonths,
    collectionFeePerInstallment,
    firstInstallmentDelayDays,
  } = input;

  if (!Number.isFinite(collectionFeePerInstallment) || collectionFeePerInstallment < 0) {
    throw new FinancialEngineError(
      "INVALID_COLLECTION_FEE",
      "La spesa di incasso rata non può essere negativa.",
    );
  }

  const firstOffset = convertDelayDaysToMonths(firstInstallmentDelayDays);
  const installment = calculateFrenchInstallment({
    financedAmount,
    customerTanPercent,
    durationMonths,
  });

  const monthlyRateDec = toDecimal(installment.monthlyRate);
  const regularBase = toDecimal(installment.roundedRegularInstallment);
  const collectionFee = roundMoney(collectionFeePerInstallment);
  const collectionFeeDec = toDecimal(collectionFee);

  const schedule: AmortizationRow[] = [];
  let openingBalance = toDecimal(financedAmount);

  for (let n = 1; n <= durationMonths; n += 1) {
    const dueOffsetMonths = firstOffset + (n - 1);
    const isLast = n === durationMonths;

    if (isLast) {
      const interestAmount = roundMoney(openingBalance.mul(monthlyRateDec));
      const principalAmount = roundMoney(openingBalance);
      const baseInstallmentAmount = roundMoney(
        toDecimal(principalAmount).plus(interestAmount),
      );
      const totalInstallmentAmount = roundMoney(
        toDecimal(baseInstallmentAmount).plus(collectionFeeDec),
      );
      const closingBalance = roundMoney(
        openingBalance.minus(principalAmount),
      );

      if (principalAmount < 0 || interestAmount < 0) {
        throw new FinancialEngineError(
          "AMORTIZATION_DID_NOT_CLOSE",
          "Quote negative rilevate nell'ultima rata.",
        );
      }

      schedule.push({
        installmentNumber: n,
        dueOffsetMonths,
        openingBalance: roundMoney(openingBalance),
        interestAmount,
        principalAmount,
        baseInstallmentAmount,
        collectionFeeAmount: collectionFee,
        totalInstallmentAmount,
        closingBalance,
      });

      openingBalance = toDecimal(closingBalance);
      break;
    }

    const interestAmount = roundMoney(openingBalance.mul(monthlyRateDec));
    let principalAmount = roundMoney(regularBase.minus(interestAmount));

    // Protezione: non ammortizzare più del saldo residuo nelle rate intermedie.
    if (toDecimal(principalAmount).greaterThan(openingBalance)) {
      principalAmount = roundMoney(openingBalance);
    }

    if (principalAmount < 0 || interestAmount < 0) {
      throw new FinancialEngineError(
        "AMORTIZATION_DID_NOT_CLOSE",
        `Quote negative alla rata ${n}.`,
      );
    }

    const baseInstallmentAmount = roundMoney(
      toDecimal(principalAmount).plus(interestAmount),
    );
    const totalInstallmentAmount = roundMoney(
      toDecimal(baseInstallmentAmount).plus(collectionFeeDec),
    );
    const closingBalance = roundMoney(openingBalance.minus(principalAmount));

    if (toDecimal(closingBalance).lessThan(-0.005)) {
      throw new FinancialEngineError(
        "AMORTIZATION_DID_NOT_CLOSE",
        `Saldo negativo significativo alla rata ${n}.`,
      );
    }

    schedule.push({
      installmentNumber: n,
      dueOffsetMonths,
      openingBalance: roundMoney(openingBalance),
      interestAmount,
      principalAmount,
      baseInstallmentAmount,
      collectionFeeAmount: collectionFee,
      totalInstallmentAmount,
      closingBalance: Math.max(closingBalance, 0),
    });

    openingBalance = toDecimal(Math.max(closingBalance, 0));
  }

  if (schedule.length !== durationMonths) {
    throw new FinancialEngineError(
      "AMORTIZATION_DID_NOT_CLOSE",
      "Numero di rate del piano non coerente con la durata.",
    );
  }

  const totalPrincipal = schedule.reduce(
    (sum, row) => sum.plus(row.principalAmount),
    new Decimal(0),
  );
  const finalBalance = schedule[schedule.length - 1]?.closingBalance ?? NaN;

  if (!almostEqual(roundMoney(totalPrincipal), roundMoney(financedAmount), 0.01)) {
    throw new FinancialEngineError(
      "AMORTIZATION_DID_NOT_CLOSE",
      `Somma quote capitale (${roundMoney(totalPrincipal)}) diversa dall'importo finanziato (${roundMoney(financedAmount)}).`,
    );
  }

  if (!almostEqual(finalBalance, 0, 0.01)) {
    throw new FinancialEngineError(
      "AMORTIZATION_DID_NOT_CLOSE",
      `Saldo residuo finale non azzerato: ${finalBalance}.`,
    );
  }

  // Normalizza l'ultimo saldo a zero se entro tolleranza.
  const last = schedule[schedule.length - 1];
  if (last && last.closingBalance !== 0 && almostEqual(last.closingBalance, 0, 0.01)) {
    last.closingBalance = 0;
  }

  return {
    monthlyRate: installment.monthlyRate,
    theoreticalBaseInstallmentAmount: installment.theoreticalInstallment,
    regularBaseInstallmentAmount: installment.roundedRegularInstallment,
    schedule,
  };
}
