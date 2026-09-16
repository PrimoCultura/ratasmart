export {
  VM_TOPICS,
  VM_TOPIC_LABELS,
  deriveTopics,
  topicFromIntent,
  topicFromKnowledgeCategory,
} from "./topics.ts";
export type { VmTopic } from "./topics.ts";

export {
  classifyKnowledgeCoverage,
  deriveCandidateIssueReasons,
  isKnowledgeSeeking,
  isTrainingSignalCandidate,
  knowledgeCoverageRate,
} from "./coverage.ts";
export type {
  CandidateIssueReasonCode,
  KnowledgeCoverageStatus,
} from "./coverage.ts";

export {
  TRAINING_SIGNAL_DEFAULTS,
  getTrainingSignalThresholds,
} from "./training-signal-config.ts";
export type { TrainingSignalThresholds } from "./training-signal-config.ts";

export const VM_INTELLIGENCE_ANALYTICS_VERSION = "1.0.0";
export const VM_INTELLIGENCE_BACKFILL_VERSION = "backfill-v1";
