import { FinancialEngineError } from "./errors.ts";
import { generateAllowedDurations } from "./durations.ts";
import type { AllowedDurationsInput } from "./types.ts";

/**
 * Condizioni economiche esplicite per una singola durata.
 * Se presenti sulla tabella, sono la fonte di verità.
 */
export type DurationTerm = {
  durationMonths: number;
  minimumAmount: number;
  maximumAmount: number;
  customerTanPercent?: number;
  /** Costo aziendale esatto per questa durata (non proporzionale). */
  internalCostPercent?: number;
};

export type TableDurationSource = AllowedDurationsInput & {
  durationTerms?: DurationTerm[];
};

export function hasDurationTerms(
  terms: DurationTerm[] | undefined | null,
): terms is DurationTerm[] {
  return Array.isArray(terms) && terms.length > 0;
}

/**
 * Durate consentite: da durationTerms se presenti, altrimenti min/max/step.
 */
export function resolveAllowedDurations(source: TableDurationSource): number[] {
  if (hasDurationTerms(source.durationTerms)) {
    const unique = new Set<number>();
    for (const term of source.durationTerms) {
      if (
        !Number.isFinite(term.durationMonths) ||
        !Number.isInteger(term.durationMonths) ||
        term.durationMonths <= 0
      ) {
        throw new FinancialEngineError(
          "INVALID_DURATION",
          "Ogni durationTerm deve avere una durata intera maggiore di zero.",
        );
      }
      unique.add(term.durationMonths);
    }
    return [...unique].sort((a, b) => a - b);
  }

  return generateAllowedDurations({
    minimumDurationMonths: source.minimumDurationMonths,
    maximumDurationMonths: source.maximumDurationMonths,
    durationStepMonths: source.durationStepMonths,
  });
}

export function findDurationTerm(
  terms: DurationTerm[] | undefined | null,
  durationMonths: number,
): DurationTerm | undefined {
  if (!hasDurationTerms(terms)) {
    return undefined;
  }
  return terms.find((term) => term.durationMonths === durationMonths);
}

/**
 * Calcola envelope min/max importo e durata da durationTerms (per campi legacy).
 */
export function envelopeFromDurationTerms(terms: DurationTerm[]): {
  minimumAmount: number;
  maximumAmount: number;
  minimumDurationMonths: number;
  maximumDurationMonths: number;
} {
  if (terms.length === 0) {
    throw new FinancialEngineError(
      "INVALID_DURATION",
      "durationTerms non può essere vuoto.",
    );
  }
  return {
    minimumAmount: Math.min(...terms.map((t) => t.minimumAmount)),
    maximumAmount: Math.max(...terms.map((t) => t.maximumAmount)),
    minimumDurationMonths: Math.min(...terms.map((t) => t.durationMonths)),
    maximumDurationMonths: Math.max(...terms.map((t) => t.durationMonths)),
  };
}
