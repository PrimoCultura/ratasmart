/**
 * Calcolo deterministico dell'anzianità lavorativa in mesi di calendario.
 * Unico helper riusato da form, confronto e snapshot.
 */
import { differenceInCalendarMonths } from "date-fns";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Interpreta `YYYY-MM-DD` a mezzogiorno locale (stesso approccio dei date input UI).
 */
export function parseEmploymentStartDate(value: string): number | undefined {
  const trimmed = value.trim();
  if (!ISO_DATE_RE.test(trimmed)) return undefined;
  const date = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.getTime();
}

/**
 * Mesi di calendario completi tra data di assunzione e data di riferimento del confronto.
 * Non arrotonda in avanti: usa differenceInCalendarMonths (date-fns).
 */
export function calculateEmploymentSeniorityMonths(input: {
  employmentStartDate: string;
  referenceDate: number;
}): number | undefined {
  const startTs = parseEmploymentStartDate(input.employmentStartDate);
  if (startTs === undefined) return undefined;
  if (!Number.isFinite(input.referenceDate)) return undefined;
  if (startTs > input.referenceDate) return 0;
  return Math.max(
    0,
    differenceInCalendarMonths(new Date(input.referenceDate), new Date(startTs)),
  );
}

/**
 * Risolve l'anzianità da usare nel policy-engine.
 * Preferisce la data di assunzione; i mesi legacy restano solo fallback.
 */
export function resolveEmploymentSeniorityMonths(input: {
  employmentStartDate?: string;
  employmentSeniorityMonths?: number;
  referenceDate: number;
}): number | undefined {
  if (input.employmentStartDate?.trim()) {
    return calculateEmploymentSeniorityMonths({
      employmentStartDate: input.employmentStartDate,
      referenceDate: input.referenceDate,
    });
  }
  if (
    input.employmentSeniorityMonths !== undefined &&
    Number.isFinite(input.employmentSeniorityMonths)
  ) {
    return Math.max(0, Math.trunc(input.employmentSeniorityMonths));
  }
  return undefined;
}
