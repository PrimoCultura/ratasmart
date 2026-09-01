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
