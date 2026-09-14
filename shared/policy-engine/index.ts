export type {
  CompatibilityEvaluation,
  CompatibilityStatus,
  EmploymentType,
  PatientFinancialProfile,
  PolicyOperator,
  PolicyRuleType,
  PolicyScope,
  RuleEvaluation,
  RuleEvaluationStatus,
  RuntimeFinancialSolution,
  RuntimePolicyRule,
  SimulationComparisonResult,
} from "./types.ts";

export {
  FISCAL_WARNING,
  FORMAL_COMPATIBILITY_DISCLAIMER,
} from "./types.ts";

export { PolicyEngineError } from "./errors.ts";
export type { PolicyEngineErrorCode } from "./errors.ts";

export {
  calculateFinancingEndDate,
  estimateAgeAtFinancingEnd,
  monthsUntilFinancingEnd,
} from "./date-utils.ts";

export {
  calculateEmploymentSeniorityMonths,
  parseEmploymentStartDate,
  resolveEmploymentSeniorityMonths,
} from "./employment-seniority.ts";

export {
  calculateAgeAtDate,
  isAdultAtDate,
  isBirthDateNotInFuture,
  parseIsoDateOnly,
  resolvePatientAge,
} from "./patient-age.ts";
export type { ResolvedPatientAge } from "./patient-age.ts";

export {
  ageYmdAt,
  compareAgeYmd,
  evaluateSmvSeniorAge,
  isAgeWithinCalendarRange,
  isAgeYmdInSmvRange,
  SMV_MAX_AGE,
  SMV_MIN_AGE,
} from "./smv-senior-age.ts";
export type { AgeYmd, SmvAgeEvaluation } from "./smv-senior-age.ts";

export { PCG_2026_POLICY_CONSTANTS } from "./pcg-2026-constants.ts";
export type { Pcg2026PolicyConstants } from "./pcg-2026-constants.ts";

export { evaluatePolicyRule } from "./rule-evaluators.ts";
export type { RuleEvaluationContext } from "./rule-evaluators.ts";

export { evaluateCompatibility } from "./compatibility.ts";

export {
  findNearestTargetSolution,
  formatTargetDistance,
  rankFinancialSolutions,
} from "./ranking.ts";

export {
  buildComparisonResult,
  buildDurationAlternatives,
  collectAvailableDurations,
  resolveInitialDuration,
} from "./comparison.ts";

export type {
  ComparisonBuildInput,
  RuntimeCompany,
  RuntimeFinancialTable,
  RuntimeInternalMessage,
  RuntimePriority,
  RuntimeProduct,
} from "./comparison.ts";

export { POLICY_ENGINE_VERSION } from "./version.ts";
