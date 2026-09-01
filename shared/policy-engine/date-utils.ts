import { addMonths } from "date-fns";
import { convertDelayDaysToMonths } from "../financial-engine/durations.ts";
import { PolicyEngineError } from "./errors.ts";

/**
 * Data dell'ultima rata (fine finanziamento) in mesi di calendario.
 *
 * lastOffset = firstInstallmentOffsetMonths + durationMonths - 1
 * endDate = calculationDate + lastOffset mesi
 */
export function calculateFinancingEndDate(input: {
  calculationDate: number;
  durationMonths: number;
  firstInstallmentDelayDays: number;
}): number {
  if (
    !Number.isFinite(input.calculationDate) ||
    !Number.isInteger(input.durationMonths) ||
    input.durationMonths <= 0
  ) {
    throw new PolicyEngineError(
      "INVALID_DURATION",
      "Durata non valida per il calcolo della fine finanziamento.",
    );
  }

  const offsetMonths = convertDelayDaysToMonths(input.firstInstallmentDelayDays);
  const monthsUntilLastInstallment = offsetMonths + input.durationMonths - 1;
  return addMonths(new Date(input.calculationDate), monthsUntilLastInstallment).getTime();
}

export function monthsUntilFinancingEnd(input: {
  durationMonths: number;
  firstInstallmentDelayDays: number;
}): number {
  const offsetMonths = convertDelayDaysToMonths(input.firstInstallmentDelayDays);
  return offsetMonths + input.durationMonths - 1;
}

/**
 * Età stimata a fine piano basata sugli anni compiuti dichiarati.
 * Non usa la data di nascita completa.
 */
export function estimateAgeAtFinancingEnd(input: {
  age: number;
  durationMonths: number;
  firstInstallmentDelayDays: number;
}): number {
  const months = monthsUntilFinancingEnd(input);
  return input.age + months / 12;
}
