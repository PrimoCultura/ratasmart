/**
 * Età calendaristica precisa per Senior SMV.
 * Min: 77 anni, 6 mesi, 1 giorno
 * Max: 85 anni, 11 mesi, 29 giorni
 */

import { parseIsoDateOnly } from "./patient-age.ts";

export type AgeYmd = {
  years: number;
  months: number;
  days: number;
};

export const SMV_MIN_AGE: AgeYmd = { years: 77, months: 6, days: 1 };
export const SMV_MAX_AGE: AgeYmd = { years: 85, months: 11, days: 29 };

export { parseIsoDateOnly };

/** Età in Y/M/D alla data di riferimento (UTC date-only). */
export function ageYmdAt(birthDateIso: string, asOfMs: number): AgeYmd | null {
  const birth = parseIsoDateOnly(birthDateIso);
  if (!birth) return null;
  const asOf = new Date(asOfMs);
  const asOfUtc = Date.UTC(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth(),
    asOf.getUTCDate(),
  );
  const asOfDate = new Date(asOfUtc);
  if (asOfDate.getTime() < birth.getTime()) return null;

  let years = asOfDate.getUTCFullYear() - birth.getUTCFullYear();
  let months = asOfDate.getUTCMonth() - birth.getUTCMonth();
  let days = asOfDate.getUTCDate() - birth.getUTCDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(
      Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), 0),
    );
    days += prevMonth.getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

export function compareAgeYmd(a: AgeYmd, b: AgeYmd): number {
  if (a.years !== b.years) return a.years - b.years;
  if (a.months !== b.months) return a.months - b.months;
  return a.days - b.days;
}

export function isAgeYmdInSmvRange(age: AgeYmd): boolean {
  return (
    compareAgeYmd(age, SMV_MIN_AGE) >= 0 && compareAgeYmd(age, SMV_MAX_AGE) <= 0
  );
}

export function isAgeWithinCalendarRange(
  birthDateIso: string,
  referenceDate: number,
  min: AgeYmd,
  max: AgeYmd,
): boolean | null {
  const age = ageYmdAt(birthDateIso, referenceDate);
  if (!age) return null;
  return compareAgeYmd(age, min) >= 0 && compareAgeYmd(age, max) <= 0;
}

export type SmvAgeEvaluation =
  | { status: "passed"; detail: string }
  | { status: "failed"; detail: string }
  | { status: "verification_required"; detail: string };

/**
 * Valuta il requisito età SMV esclusivamente da birthDate + referenceDate.
 * Senza data di nascita → verification_required (nessuna data inventata).
 */
export function evaluateSmvSeniorAge(input: {
  age?: number;
  birthDate?: string;
  calculationDate: number;
}): SmvAgeEvaluation {
  if (!input.birthDate?.trim()) {
    return {
      status: "verification_required",
      detail:
        "Per verificare l’età Senior SMV è necessaria la data di nascita (non si usa solo l’età intera legacy).",
    };
  }

  const ageYmd = ageYmdAt(input.birthDate, input.calculationDate);
  if (!ageYmd) {
    return {
      status: "verification_required",
      detail: "Data di nascita non valida per verificare l’età Senior SMV.",
    };
  }
  if (isAgeYmdInSmvRange(ageYmd)) {
    return {
      status: "passed",
      detail: `Età Senior SMV OK: ${ageYmd.years}a ${ageYmd.months}m ${ageYmd.days}g.`,
    };
  }
  return {
    status: "failed",
    detail: `Età ${ageYmd.years}a ${ageYmd.months}m ${ageYmd.days}g fuori dal range Senior SMV (77a 6m 1g – 85a 11m 29g).`,
  };
}
