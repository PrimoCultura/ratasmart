export type {
  ChatPrivacyMode,
  KnowledgeCardVisibility,
  KnowledgeCategory,
  KnowledgeNetwork,
  KnowledgeSelectionContext,
  KnowledgeSelectionOptions,
  KnowledgeSelectionResult,
  RuntimeKnowledgeCard,
  SelectedKnowledgeCard,
} from "./types.ts";

export {
  DEFAULT_MAX_CARDS,
  DEFAULT_MAX_CHARACTERS,
  KNOWLEDGE_SCORE_WEIGHTS,
} from "./types.ts";

export {
  cardCharacterCount,
  normalizeKeywords,
  normalizeText,
  tokenizeQuestion,
} from "./normalize.ts";

export {
  isCardValidAt,
  isNetworkCompatible,
  isScopeCompatible,
  isVisibilityCompatible,
  resolveCardVisibility,
  scoreKnowledgeCard,
} from "./scoring.ts";

export type { ScoredKnowledgeCard } from "./scoring.ts";

export {
  formatKnowledgeContext,
  selectRelevantKnowledgeCards,
} from "./selection.ts";
