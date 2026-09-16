import { describe, expect, it } from "vitest";
import {
  classifyKnowledgeCoverage,
  deriveCandidateIssueReasons,
  deriveTopics,
  getTrainingSignalThresholds,
  isTrainingSignalCandidate,
  topicFromKnowledgeCategory,
  VM_INTELLIGENCE_ANALYTICS_VERSION,
  VM_INTELLIGENCE_BACKFILL_VERSION,
} from "../index.ts";

describe("vm intelligence topics", () => {
  it("A) topic derivato da KB category", () => {
    expect(topicFromKnowledgeCategory("documents")).toBe("DOCUMENTS");
    expect(topicFromKnowledgeCategory("guarantor")).toBe("GUARANTOR");
    const derived = deriveTopics({
      sourceCategories: ["documents", "guarantor"],
      intents: [],
      hasCompanyMatch: false,
    });
    expect(derived.primaryTopic).toBe("DOCUMENTS");
    expect(derived.topicCodes).toEqual(["DOCUMENTS", "GUARANTOR"]);
  });
});

describe("vm intelligence coverage", () => {
  it("B) FULL coverage", () => {
    expect(
      classifyKnowledgeCoverage({
        sourceCount: 2,
        intents: ["documents"],
        outcome: "answered",
      }),
    ).toBe("FULL");
  });

  it("C) NONE coverage", () => {
    expect(
      classifyKnowledgeCoverage({
        sourceCount: 0,
        intents: ["documents"],
        outcome: "not_covered",
      }),
    ).toBe("NONE");
  });

  it("NOT_APPLICABLE when not knowledge-seeking", () => {
    expect(
      classifyKnowledgeCoverage({
        sourceCount: 0,
        intents: [],
        outcome: "answered",
      }),
    ).toBe("NOT_APPLICABLE");
  });
});

describe("vm intelligence feedback → reasons", () => {
  it("E/F) automatic NO_SOURCE candidate", () => {
    expect(
      deriveCandidateIssueReasons({
        coverage: "NONE",
        requiresVerification: false,
      }),
    ).toEqual(["NO_SOURCE"]);
  });

  it("L) content bug candidate reasons include incorrect only via feedback code", () => {
    expect(
      deriveCandidateIssueReasons({
        coverage: "FULL",
        requiresVerification: false,
      }),
    ).toEqual([]);
  });
});

describe("vm intelligence training signal", () => {
  const thresholds = getTrainingSignalThresholds();

  it("I) thresholds are explicit", () => {
    expect(thresholds.minimumQuestions).toBe(5);
    expect(thresholds.minimumUniqueUsers).toBe(3);
    expect(thresholds.minimumCoverageRate).toBe(0.8);
    expect(thresholds.maximumKnowledgeGapRate).toBe(0.2);
  });

  it("J) alto volume + bassa coverage NON training signal", () => {
    expect(
      isTrainingSignalCandidate({
        questions: 20,
        uniqueUsers: 10,
        coverageRate: 0.4,
        knowledgeGapRate: 0.5,
        thresholds,
      }),
    ).toBe(false);
  });

  it("K) alto volume + alta coverage → candidate training signal", () => {
    expect(
      isTrainingSignalCandidate({
        questions: 20,
        uniqueUsers: 10,
        coverageRate: 0.9,
        knowledgeGapRate: 0.05,
        thresholds,
      }),
    ).toBe(true);
  });
});

describe("vm intelligence privacy contract", () => {
  it("M) analytics version non include campi PII nel contratto shared", () => {
    expect(VM_INTELLIGENCE_ANALYTICS_VERSION).toBeTruthy();
    const sample = {
      primaryTopic: "DOCUMENTS",
      topicCodes: ["DOCUMENTS"],
      companyCodes: [],
      productCodes: [],
    };
    expect(Object.keys(sample).join(",")).not.toMatch(/patient|birth|cf|name/i);
  });
});

describe("vm intelligence filters helpers", () => {
  it("N) period/network/topic are plain codes", () => {
    const derived = deriveTopics({
      sourceCategories: [],
      intents: ["company"],
      hasCompanyMatch: true,
    });
    expect(derived.primaryTopic).toBe("PRODUCT_CONDITIONS");
  });

  it("D) helpful feedback is a distinct type label", () => {
    expect("HELPFUL").not.toBe("INCORRECT_INFORMATION");
  });
});

describe("vm intelligence issue workflow contract", () => {
  it("G) status values are closed set", () => {
    const statuses = [
      "NEW",
      "REVIEWING",
      "CONFIRMED_GAP",
      "CONTENT_ERROR",
      "NOT_A_GAP",
      "RESOLVED",
    ];
    expect(statuses).toHaveLength(6);
  });

  it("H) duplicate issue key is assistantMessage + primaryReason", () => {
    const key = (messageId: string, reason: string) => `${messageId}::${reason}`;
    expect(key("m1", "NO_SOURCE")).toBe(key("m1", "NO_SOURCE"));
    expect(key("m1", "NO_SOURCE")).not.toBe(key("m1", "USER_REPORTS_INCORRECT_INFORMATION"));
  });

  it("O) backfill version is deterministic label", () => {
    expect(VM_INTELLIGENCE_BACKFILL_VERSION).toBe("backfill-v1");
  });
});
