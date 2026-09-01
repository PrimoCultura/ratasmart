export type {
  AnonymizedPatientProfile,
  AnonymizedSimulationContextInput,
  AnonymizedSolutionSummary,
  AssistantMessageRole,
  ChatPrivacyMode,
  EntityCatalogItem,
  HistoryMessage,
  MatchedEntities,
  PromptBuildInput,
  PromptBuildResult,
} from "./types.ts";

export {
  DEFAULT_HISTORY_MAX_CHARACTERS,
  DEFAULT_HISTORY_MAX_MESSAGES,
  DEFAULT_PROMPT_MAX_CHARACTERS,
} from "./types.ts";

export {
  assertNoPatientIdentifiers,
  EMPLOYMENT_TYPE_LABELS,
  isPatientSafe,
} from "./privacy.ts";

export { buildAnonymizedSimulationContext } from "./simulation-context.ts";
export {
  buildComparisonContextSection,
  mapSolutionSnapshotToSummary,
} from "./comparison-context.ts";
export { matchEntitiesFromQuestion } from "./entity-matching.ts";
export {
  buildEntityCatalogFromActiveData,
  buildPolicyAndTableContext,
} from "./policy-context.ts";
export {
  buildConversationTitleFromQuestion,
  formatHistoryForPrompt,
  selectHistoryForPrompt,
} from "./history.ts";
export { buildVirtualMarcoPrompt } from "./prompt-builder.ts";
