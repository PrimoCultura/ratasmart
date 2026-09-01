import { FinancialEngineError } from "./errors.ts";
import type { AllowedDurationsInput } from "./types.ts";

function assertPositiveInteger(
  value: number,
  fieldName: string,
): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new FinancialEngineError(
      "INVALID_DURATION",
      `${fieldName} deve essere un intero maggiore di zero.`,
    );
  }
}

/**
 * Genera le durate disponibili da minimo, massimo e step.
 * Il massimo è incluso solo se raggiunto esattamente dalla progressione.
 */
export function generateAllowedDurations(
  input: AllowedDurationsInput,
): number[] {
  const { minimumDurationMonths, maximumDurationMonths, durationStepMonths } =
    input;

  assertPositiveInteger(minimumDurationMonths, "La durata minima");
  assertPositiveInteger(maximumDurationMonths, "La durata massima");
  assertPositiveInteger(durationStepMonths, "Lo step durata");

  if (maximumDurationMonths < minimumDurationMonths) {
    throw new FinancialEngineError(
      "INVALID_DURATION",
      "La durata massima deve essere maggiore o uguale alla durata minima.",
    );
  }

  const durations: number[] = [];
  for (
    let current = minimumDurationMonths;
    current <= maximumDurationMonths;
    current += durationStepMonths
  ) {
    durations.push(current);
  }

  return durations;
}

/**
 * Converte i giorni di differimento della prima rata in mesi di offset.
 * Accetta soltanto multipli positivi di 30 (V1: 30/60/90).
 */
export function convertDelayDaysToMonths(delayDays: number): number {
  if (!Number.isFinite(delayDays) || !Number.isInteger(delayDays) || delayDays <= 0) {
    throw new FinancialEngineError(
      "INVALID_FIRST_INSTALLMENT_DELAY",
      "Il differimento della prima rata deve essere un intero positivo.",
    );
  }

  if (delayDays % 30 !== 0) {
    throw new FinancialEngineError(
      "INVALID_FIRST_INSTALLMENT_DELAY",
      "Il differimento della prima rata deve essere un multiplo positivo di 30 giorni.",
    );
  }

  return delayDays / 30;
}
