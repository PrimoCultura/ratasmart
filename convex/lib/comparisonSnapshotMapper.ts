/**
 * Wrapper Convex sul mapper puro shared/comparison-snapshot.
 * Mantiene la logica di mapping fuori dalle mutation inline.
 */
export {
  buildSelectedSolutionLabel,
  canProposeSolution,
  findDuplicateByRequestId,
  hasInputsChangedAfterRun,
  isDuplicateRequestId,
  mapAllSolutionsFromComparison,
  mapCalculationSummary,
  mapRuntimeComparisonToRunFields,
  mapRuntimeSolutionToPersistentSnapshot,
  nextRunNumber,
  normalizeOptional,
  regenerateAmortizationFromInputSnapshot,
  getStaleEngineVersionWarning,
  stripUndefinedDeep,
} from "../../shared/comparison-snapshot/index";

export type {
  CalculationInputSnapshot,
  CalculationSummarySnapshot,
  ComparisonRunFields,
  ComparisonSource,
  MessagePayloadForSnapshot,
  PatientSnapshot,
  PersistentSolutionFields,
  ProductMetadataForSnapshot,
  TableMetadataForSnapshot,
} from "../../shared/comparison-snapshot/index";
