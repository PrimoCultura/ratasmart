/**
 * Età paziente deterministica da data di nascita + data di riferimento.
 * Unico helper per form, comparison, policy e snapshot.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDateOnly(value: string): Date | null {
  const trimmed = value.trim();
  if (!ISO_DATE_RE.test(trimmed)) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function toUtcDateOnly(ms: number): Date {
  const asOf = new Date(ms);
  return new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );
}

/**
 * Anni compiuti alla `referenceDate` (UTC date-only).
 * Confronta anno/mese/giorno: non usa solo currentYear - birthYear.
 */
export function calculateAgeAtDate(
  birthDateIso: string,
  referenceDate: number,
): number | null {
  const birth = parseIsoDateOnly(birthDateIso);
  if (!birth || !Number.isFinite(referenceDate)) return null;
  const asOf = toUtcDateOnly(referenceDate);
  if (asOf.getTime() < birth.getTime()) return null;

  let years = asOf.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - birth.getUTCMonth();
  const dayDiff = asOf.getUTCDate() - birth.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years -= 1;
  }
  return years;
}

export function isAdultAtDate(
  birthDateIso: string,
  referenceDate: number,
): boolean {
  const age = calculateAgeAtDate(birthDateIso, referenceDate);
  return age !== null && age >= 18;
}

export function isBirthDateNotInFuture(
  birthDateIso: string,
  referenceDate: number,
): boolean {
  const birth = parseIsoDateOnly(birthDateIso);
  if (!birth || !Number.isFinite(referenceDate)) return false;
  return birth.getTime() <= toUtcDateOnly(referenceDate).getTime();
}

export type ResolvedPatientAge = {
  /** Anni compiuti alla referenceDate (derivati o legacy). */
  age: number;
  ageAtReferenceDate?: number;
  birthDate?: string;
  source: "birthDate" | "legacy_age";
};

/**
 * Risolve l'età per policy evaluation.
 * Preferisce birthDate; legacy age solo se birthDate assente.
 */
export function resolvePatientAge(input: {
  birthDate?: string;
  legacyAge?: number;
  referenceDate: number;
}): ResolvedPatientAge | null {
  if (input.birthDate?.trim()) {
    const age = calculateAgeAtDate(input.birthDate, input.referenceDate);
    if (age === null) return null;
    return {
      age,
      ageAtReferenceDate: age,
      birthDate: input.birthDate.trim(),
      source: "birthDate",
    };
  }
  if (
    input.legacyAge !== undefined &&
    Number.isFinite(input.legacyAge) &&
    input.legacyAge >= 0
  ) {
    return {
      age: Math.trunc(input.legacyAge),
      source: "legacy_age",
    };
  }
  return null;
}
