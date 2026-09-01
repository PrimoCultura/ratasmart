export type {
  CalculationInputSnapshot,
  CalculationSummarySnapshot,
  CompanySnapshot,
  ComparisonRunFields,
  ComparisonSource,
  ComparisonStatus,
  CompatibilitySnapshot,
  EmploymentTypeSnapshot,
  FinancialTableSnapshot,
  InternalMessageSnapshot,
  MessagePayloadForSnapshot,
  NetworkCode,
  OpeningFeeTypeSnapshot,
  PatientSnapshot,
  PersistentSolutionFields,
  PrioritySnapshot,
  ProductMetadataForSnapshot,
  ProductSnapshot,
  ResultGroup,
  RuleSnapshot,
  TableMetadataForSnapshot,
} from "./types.ts";

export {
  normalizeOptional,
  stripUndefined,
  stripUndefinedDeep,
} from "./normalize.ts";

export {
  findDuplicateByRequestId,
  hasInputsChangedAfterRun,
  isDuplicateRequestId,
  nextRunNumber,
} from "./idempotency.ts";

export {
  buildSelectedSolutionLabel,
  canProposeSolution,
  mapAllSolutionsFromComparison,
  mapCalculationInputSnapshot,
  mapCalculationSummary,
  mapCompatibilitySnapshot,
  mapInternalMessagesSnapshot,
  mapRuntimeComparisonToRunFields,
  mapRuntimeSolutionToPersistentSnapshot,
} from "./mapper.ts";

export type { MapRunInput, MapSolutionInput } from "./mapper.ts";

export {
  STALE_ENGINE_VERSION_WARNING,
  compareCalculationSummaries,
  getStaleEngineVersionWarning,
  isStaleEngineVersion,
  regenerateAmortizationFromInputSnapshot,
} from "./regenerate.ts";

export type { RegenerateAmortizationResult } from "./regenerate.ts";
