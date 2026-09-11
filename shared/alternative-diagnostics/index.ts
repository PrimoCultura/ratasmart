import { resolveAllowedDurations } from "../financial-engine/index.ts";
import {
  resolveTableEconomicsForDuration,
  type RuntimeFinancialTable,
} from "../policy-engine/comparison.ts";

/**
 * Durate realmente utilizzabili nel confronto per importo e delay correnti.
 * Non genera range numerici arbitrari (es. 6..84).
 */
export function collectComparisonDurationOptions(input: {
  tables: RuntimeFinancialTable[];
  requestedAmount: number;
  firstInstallmentDelayDays?: number;
}): number[] {
  const set = new Set<number>();
  for (const table of input.tables) {
    if (!table.isActive) continue;
    if (
      input.firstInstallmentDelayDays !== undefined &&
      !table.firstInstallmentDelayDays.includes(input.firstInstallmentDelayDays)
    ) {
      continue;
    }
    for (const duration of resolveAllowedDurations(table)) {
      const economics = resolveTableEconomicsForDuration(table, duration);
      if (!economics) continue;
      if (
        input.requestedAmount < economics.minimumAmount ||
        input.requestedAmount > economics.maximumAmount
      ) {
        continue;
      }
      set.add(duration);
    }
  }
  return [...set].sort((a, b) => a - b);
}

export {
  ALTERNATIVE_DIAGNOSTICS_VERSION,
  type AlternativeScenario,
  type BlockingConstraint,
  type ComparisonDiagnostics,
  type InformationalSuggestion,
} from "./diagnostic-types.ts";
export { analyzeBlockingConstraints, pickPrimaryConstraint } from "./analyze-failure-reasons.ts";
export {
  findAlternativeScenarios,
  noDurationFitsTemporalWindow,
} from "./find-alternative-scenarios.ts";
export { buildComparisonDiagnostics } from "./build-comparison-diagnostics.ts";
export {
  buildDiagnosticsFromPersistedComparison,
  resolveComparisonDiagnostics,
} from "./from-persisted-run.ts";
export type { PersistedSolutionForDiagnostics } from "./from-persisted-run.ts";
export {
  COMPLETE_EMPLOYMENT_START_DATE_MESSAGE,
  isEmploymentSeniorityUndeterminable,
  resolveUnresolvedPatientDataGuidance,
} from "./unresolved-patient-data.ts";
