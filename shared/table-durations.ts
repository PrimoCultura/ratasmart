/**
 * Durate operative delle tabelle finanziarie.
 * Fonte unica usata da UI e assistant-context (preferisce durationTerms).
 */

export type DurationTermLike = {
  durationMonths: number;
};

export function generateDurationMonths(
  minimum: number,
  maximum: number,
  step: number,
): number[] {
  if (
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    !Number.isFinite(step) ||
    minimum <= 0 ||
    maximum < minimum ||
    step <= 0
  ) {
    return [];
  }
  const durations: number[] = [];
  for (let current = minimum; current <= maximum; current += step) {
    durations.push(current);
  }
  return durations;
}

/** Preferisce durationTerms se presenti; altrimenti min/max/step. */
export function resolveTableDurationMonths(input: {
  minimumDurationMonths: number;
  maximumDurationMonths: number;
  durationStepMonths: number;
  durationTerms?: DurationTermLike[] | null;
}): number[] {
  if (input.durationTerms && input.durationTerms.length > 0) {
    return [
      ...new Set(input.durationTerms.map((term) => term.durationMonths)),
    ].sort((a, b) => a - b);
  }
  return generateDurationMonths(
    input.minimumDurationMonths,
    input.maximumDurationMonths,
    input.durationStepMonths,
  );
}
