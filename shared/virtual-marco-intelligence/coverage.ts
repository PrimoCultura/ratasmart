/**
 * Coverage e candidati gap — solo da segnali strutturati (no euristiche sul testo).
 * PARTIAL non è usato: non affidabile con la pipeline attuale.
 */

export type KnowledgeCoverageStatus = "FULL" | "NONE" | "NOT_APPLICABLE";

export type CandidateIssueReasonCode =
  | "NO_SOURCE"
  | "REQUIRES_EXTERNAL_VERIFICATION"
  | "USER_REPORTS_MISSING_INFORMATION"
  | "USER_REPORTS_INCORRECT_INFORMATION"
  | "REPEATED_UNRESOLVED_TOPIC";

export function isKnowledgeSeeking(input: {
  sourceCount: number;
  intents: string[];
  outcome?: string;
}): boolean {
  if (input.sourceCount > 0) return true;
  if (input.outcome === "not_covered") return true;
  const knowledgeIntents = input.intents.filter(
    (intent) => intent !== "generic",
  );
  return knowledgeIntents.length > 0;
}

/**
 * FULL: almeno una fonte strutturata.
 * NONE: domanda knowledge-seeking senza fonti.
 * NOT_APPLICABLE: non richiede knowledge retrieval.
 */
export function classifyKnowledgeCoverage(input: {
  sourceCount: number;
  intents: string[];
  outcome?: string;
}): KnowledgeCoverageStatus {
  if (input.sourceCount > 0) return "FULL";
  if (isKnowledgeSeeking(input)) return "NONE";
  return "NOT_APPLICABLE";
}

export function deriveCandidateIssueReasons(input: {
  coverage: KnowledgeCoverageStatus;
  requiresVerification: boolean;
}): CandidateIssueReasonCode[] {
  const reasons: CandidateIssueReasonCode[] = [];
  if (input.coverage === "NONE") {
    reasons.push("NO_SOURCE");
  }
  if (input.requiresVerification) {
    reasons.push("REQUIRES_EXTERNAL_VERIFICATION");
  }
  return reasons;
}

export function knowledgeCoverageRate(input: {
  withSource: number;
  knowledgeSeeking: number;
}): number | null {
  if (input.knowledgeSeeking <= 0) return null;
  return input.withSource / input.knowledgeSeeking;
}

export function isTrainingSignalCandidate(input: {
  questions: number;
  uniqueUsers: number;
  coverageRate: number | null;
  knowledgeGapRate: number | null;
  thresholds: {
    minimumQuestions: number;
    minimumUniqueUsers: number;
    minimumCoverageRate: number;
    maximumKnowledgeGapRate: number;
  };
}): boolean {
  if (input.questions < input.thresholds.minimumQuestions) return false;
  if (input.uniqueUsers < input.thresholds.minimumUniqueUsers) return false;
  if (
    input.coverageRate === null ||
    input.coverageRate < input.thresholds.minimumCoverageRate
  ) {
    return false;
  }
  const gapRate = input.knowledgeGapRate ?? 0;
  if (gapRate > input.thresholds.maximumKnowledgeGapRate) return false;
  return true;
}
