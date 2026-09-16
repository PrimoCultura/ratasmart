import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/authHelpers";
import {
  findUserMessageForAssistant,
  recordAssistantInteractionAnalytics,
  VM_INTELLIGENCE_BACKFILL_VERSION,
} from "./lib/vmIntelligence";
import {
  getTrainingSignalThresholds,
  isTrainingSignalCandidate,
  knowledgeCoverageRate,
  VM_TOPIC_LABELS,
  type VmTopic,
} from "../shared/virtual-marco-intelligence";
import { percent as pct } from "../shared/admin-analytics";

const networkValidator = v.union(
  v.literal("PCG"),
  v.literal("DES"),
  v.literal("Paoleschi"),
);

const issueStatusValidator = v.union(
  v.literal("NEW"),
  v.literal("REVIEWING"),
  v.literal("CONFIRMED_GAP"),
  v.literal("CONTENT_ERROR"),
  v.literal("NOT_A_GAP"),
  v.literal("RESOLVED"),
);

function inRange(ts: number, fromMs: number, toMs: number) {
  return ts >= fromMs && ts <= toMs;
}

/**
 * Dashboard aggregata Virtual Marco Intelligence (server-side).
 */
export const getVmIntelligenceDashboard = query({
  args: {
    actorUserId: v.id("appUsers"),
    fromMs: v.number(),
    toMs: v.number(),
    network: v.optional(networkValidator),
    topic: v.optional(v.string()),
    companyCode: v.optional(v.string()),
    productCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);

    const interactions = (
      await ctx.db.query("assistantInteractionAnalytics").collect()
    ).filter((row) => {
      if (!inRange(row.createdAt, args.fromMs, args.toMs)) return false;
      if (args.network && row.network !== args.network) return false;
      if (args.topic && row.primaryTopic !== args.topic) return false;
      if (
        args.companyCode &&
        !row.companyCodes.includes(args.companyCode)
      ) {
        return false;
      }
      if (
        args.productCode &&
        !row.productCodes.includes(args.productCode)
      ) {
        return false;
      }
      return true;
    });

    const users = await ctx.db.query("appUsers").collect();
    const clinicByUser = new Map(
      users.map((user) => [user._id as string, user.clinicName ?? null]),
    );

    const uniqueUsers = new Set(interactions.map((row) => row.userId));
    const knowledgeSeeking = interactions.filter(
      (row) => row.knowledgeCoverageStatus !== "NOT_APPLICABLE",
    );
    const withSource = knowledgeSeeking.filter(
      (row) => row.knowledgeCoverageStatus === "FULL",
    );
    const coverage = knowledgeCoverageRate({
      withSource: withSource.length,
      knowledgeSeeking: knowledgeSeeking.length,
    });

    const issues = (
      await ctx.db.query("knowledgeIssues").collect()
    ).filter((issue) => inRange(issue.createdAt, args.fromMs, args.toMs));

    const candidateIssues = issues.filter(
      (issue) =>
        issue.status === "NEW" ||
        issue.status === "REVIEWING" ||
        issue.detectedBy === "AUTOMATIC_RULE" ||
        issue.detectedBy === "USER_FEEDBACK",
    );
    const confirmedOpen = issues.filter(
      (issue) =>
        issue.status === "CONFIRMED_GAP" || issue.status === "CONTENT_ERROR",
    );

    const feedbacks = (
      await ctx.db.query("assistantFeedback").collect()
    ).filter((item) => inRange(item.createdAt, args.fromMs, args.toMs));
    const negativeFeedbacks = feedbacks.filter(
      (item) => item.feedbackType !== "HELPFUL",
    );

    // Topics rollup
    type TopicAgg = {
      topic: string;
      questions: number;
      users: Set<string>;
      clinics: Set<string>;
      networks: Record<string, number>;
      full: number;
      seeking: number;
      issues: number;
      negativeFeedback: number;
      companies: Record<string, number>;
      products: Record<string, number>;
    };
    const topicMap = new Map<string, TopicAgg>();
    for (const row of interactions) {
      const agg = topicMap.get(row.primaryTopic) ?? {
        topic: row.primaryTopic,
        questions: 0,
        users: new Set<string>(),
        clinics: new Set<string>(),
        networks: {},
        full: 0,
        seeking: 0,
        issues: 0,
        negativeFeedback: 0,
        companies: {},
        products: {},
      };
      agg.questions += 1;
      agg.users.add(row.userId);
      const clinic = clinicByUser.get(row.userId);
      if (clinic) agg.clinics.add(clinic);
      if (row.network) {
        agg.networks[row.network] = (agg.networks[row.network] ?? 0) + 1;
      }
      if (row.knowledgeCoverageStatus !== "NOT_APPLICABLE") {
        agg.seeking += 1;
        if (row.knowledgeCoverageStatus === "FULL") agg.full += 1;
      }
      for (const code of row.companyCodes) {
        agg.companies[code] = (agg.companies[code] ?? 0) + 1;
      }
      for (const code of row.productCodes) {
        agg.products[code] = (agg.products[code] ?? 0) + 1;
      }
      topicMap.set(row.primaryTopic, agg);
    }

    const issueByMessage = new Map<string, number>();
    for (const issue of issues) {
      const key = issue.assistantMessageId;
      issueByMessage.set(key, (issueByMessage.get(key) ?? 0) + 1);
      const analytics = interactions.find(
        (row) => row.assistantMessageId === issue.assistantMessageId,
      );
      if (analytics) {
        const agg = topicMap.get(analytics.primaryTopic);
        if (agg) agg.issues += 1;
      }
    }

    const negativeByMessage = new Set(
      negativeFeedbacks.map((item) => item.assistantMessageId as string),
    );
    for (const row of interactions) {
      if (negativeByMessage.has(row.assistantMessageId)) {
        const agg = topicMap.get(row.primaryTopic);
        if (agg) agg.negativeFeedback += 1;
      }
    }

    const thresholds = getTrainingSignalThresholds();
    const totalQuestions = interactions.length || 1;

    const topics = [...topicMap.values()]
      .map((agg) => {
        const coverageRate = knowledgeCoverageRate({
          withSource: agg.full,
          knowledgeSeeking: agg.seeking,
        });
        const gapRate = pct(agg.issues, agg.questions);
        const trainingCandidate = isTrainingSignalCandidate({
          questions: agg.questions,
          uniqueUsers: agg.users.size,
          coverageRate,
          knowledgeGapRate: gapRate,
          thresholds,
        });
        return {
          topic: agg.topic,
          label:
            VM_TOPIC_LABELS[agg.topic as VmTopic] ?? agg.topic,
          questions: agg.questions,
          percent: pct(agg.questions, totalQuestions),
          uniqueUsers: agg.users.size,
          uniqueClinics: agg.clinics.size,
          networks: agg.networks,
          coverageRate,
          issueRate: gapRate,
          negativeFeedbackRate: pct(agg.negativeFeedback, agg.questions),
          trainingSignal: trainingCandidate,
          topCompanies: Object.entries(agg.companies)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([code, count]) => ({ code, count })),
          topProducts: Object.entries(agg.products)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([code, count]) => ({ code, count })),
        };
      })
      .sort((a, b) => b.questions - a.questions);

    // Company rollup
    const companyMap = new Map<
      string,
      { count: number; topics: Record<string, number> }
    >();
    for (const row of interactions) {
      for (const code of row.companyCodes) {
        const agg = companyMap.get(code) ?? { count: 0, topics: {} };
        agg.count += 1;
        agg.topics[row.primaryTopic] =
          (agg.topics[row.primaryTopic] ?? 0) + 1;
        companyMap.set(code, agg);
      }
    }
    const companies = [...companyMap.entries()]
      .map(([code, agg]) => ({
        companyCode: code,
        questions: agg.count,
        topTopics: Object.entries(agg.topics)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([topic, count]) => ({
            topic,
            label: VM_TOPIC_LABELS[topic as VmTopic] ?? topic,
            count,
            percent: pct(count, agg.count),
          })),
      }))
      .sort((a, b) => b.questions - a.questions)
      .slice(0, 20);

    const productMap = new Map<string, number>();
    for (const row of interactions) {
      for (const code of row.productCodes) {
        productMap.set(code, (productMap.get(code) ?? 0) + 1);
      }
    }
    const products = [...productMap.entries()]
      .map(([code, count]) => ({ productCode: code, questions: count }))
      .sort((a, b) => b.questions - a.questions)
      .slice(0, 20);

    const trainingSignals = topics.filter((topic) => topic.trainingSignal);
    const contentBugCandidates = issues.filter(
      (issue) =>
        issue.reasonCodes.includes("USER_REPORTS_INCORRECT_INFORMATION") ||
        issue.status === "CONTENT_ERROR",
    ).length;

    const coverageBreakdown = {
      FULL: interactions.filter((r) => r.knowledgeCoverageStatus === "FULL")
        .length,
      NONE: interactions.filter((r) => r.knowledgeCoverageStatus === "NONE")
        .length,
      NOT_APPLICABLE: interactions.filter(
        (r) => r.knowledgeCoverageStatus === "NOT_APPLICABLE",
      ).length,
    };

    return {
      period: { fromMs: args.fromMs, toMs: args.toMs },
      kpis: {
        questions: interactions.length,
        uniqueUsers: uniqueUsers.size,
        knowledgeCoverageRate: coverage,
        candidateIssues: candidateIssues.length,
        negativeFeedbacks: negativeFeedbacks.length,
        confirmedOpenIssues: confirmedOpen.length,
      },
      coverageBreakdown,
      topics,
      companies,
      products,
      trainingSignals,
      trainingThresholds: thresholds,
      contentBugCandidates,
      matrixHints: {
        highQuestionsLowCoverage:
          "ALTE DOMANDE + BASSA COVERAGE → possibile knowledge gap",
        highQuestionsHighCoverage:
          "ALTE DOMANDE + ALTA COVERAGE → possibile training signal",
        lowQuestionsLowCoverage:
          "BASSE DOMANDE + BASSA COVERAGE → gap occasionale da verificare",
        highIncorrectFeedback:
          "ALTA % FEEDBACK ERRATO → possibile content bug",
      },
      empty: interactions.length === 0,
      // PARTIAL non determinabile in modo affidabile
      partialCoverageAvailable: false,
    };
  },
});

export const listKnowledgeIssuesAdmin = query({
  args: {
    actorUserId: v.id("appUsers"),
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
    status: v.optional(issueStatusValidator),
    topic: v.optional(v.string()),
    network: v.optional(networkValidator),
    companyCode: v.optional(v.string()),
    productCode: v.optional(v.string()),
    detectedBy: v.optional(
      v.union(
        v.literal("AUTOMATIC_RULE"),
        v.literal("USER_FEEDBACK"),
        v.literal("ADMIN"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    let issues = await ctx.db.query("knowledgeIssues").collect();
    issues.sort((a, b) => b.createdAt - a.createdAt);
    issues = issues.slice(0, 400);

    if (args.status) {
      issues = issues.filter((issue) => issue.status === args.status);
    }
    if (args.topic) {
      issues = issues.filter((issue) => issue.topic === args.topic);
    }
    if (args.network) {
      issues = issues.filter((issue) => issue.network === args.network);
    }
    if (args.detectedBy) {
      issues = issues.filter((issue) => issue.detectedBy === args.detectedBy);
    }
    if (args.fromMs !== undefined && args.toMs !== undefined) {
      issues = issues.filter((issue) =>
        inRange(issue.createdAt, args.fromMs!, args.toMs!),
      );
    }
    if (args.companyCode) {
      issues = issues.filter((issue) =>
        issue.companyCodes.includes(args.companyCode!),
      );
    }
    if (args.productCode) {
      issues = issues.filter((issue) =>
        issue.productCodes.includes(args.productCode!),
      );
    }

    return issues.map((issue) => ({
      ...issue,
      topicLabel: VM_TOPIC_LABELS[issue.topic as VmTopic] ?? issue.topic,
    }));
  },
});

export const getKnowledgeIssueDetail = query({
  args: {
    actorUserId: v.id("appUsers"),
    issueId: v.id("knowledgeIssues"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const issue = await ctx.db.get(args.issueId);
    if (!issue) return null;

    const userMessage = await ctx.db.get(issue.userMessageId);
    const assistantMessage = await ctx.db.get(issue.assistantMessageId);
    const sources = await ctx.db
      .query("assistantMessageSources")
      .withIndex("by_message", (q) =>
        q.eq("assistantMessageId", issue.assistantMessageId),
      )
      .collect();
    const feedbacks = await ctx.db
      .query("assistantFeedback")
      .withIndex("by_assistant_message", (q) =>
        q.eq("assistantMessageId", issue.assistantMessageId),
      )
      .collect();
    const analytics = await ctx.db
      .query("assistantInteractionAnalytics")
      .withIndex("by_assistant_message", (q) =>
        q.eq("assistantMessageId", issue.assistantMessageId),
      )
      .unique();

    return {
      issue: {
        ...issue,
        topicLabel: VM_TOPIC_LABELS[issue.topic as VmTopic] ?? issue.topic,
      },
      userMessage: userMessage
        ? {
            _id: userMessage._id,
            content: userMessage.content,
            createdAt: userMessage.createdAt,
          }
        : null,
      assistantMessage: assistantMessage
        ? {
            _id: assistantMessage._id,
            content: assistantMessage.content,
            outcome: assistantMessage.outcome,
            requiresVerification: assistantMessage.requiresVerification,
            createdAt: assistantMessage.createdAt,
            completedAt: assistantMessage.completedAt,
          }
        : null,
      sources: sources.map((source) => ({
        knowledgeCardId: source.knowledgeCardId,
        titleSnapshot: source.titleSnapshot,
        categorySnapshot: source.categorySnapshot,
        score: source.score,
      })),
      feedbacks: feedbacks.map((item) => ({
        feedbackType: item.feedbackType,
        comment: item.comment,
        createdAt: item.createdAt,
        userId: item.userId,
      })),
      analytics,
    };
  },
});

export const updateKnowledgeIssueStatus = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    issueId: v.id("knowledgeIssues"),
    status: issueStatusValidator,
    adminNotes: v.optional(v.string()),
    linkedKnowledgeCardId: v.optional(v.id("knowledgeCards")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.actorUserId);
    const issue = await ctx.db.get(args.issueId);
    if (!issue) throw new Error("Issue non trovata.");

    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
      reviewedBy: admin._id,
    };
    if (args.adminNotes !== undefined) {
      patch.adminNotes = args.adminNotes.trim() || undefined;
    }
    if (args.linkedKnowledgeCardId !== undefined) {
      patch.linkedKnowledgeCardId = args.linkedKnowledgeCardId;
    }
    if (args.status === "RESOLVED" || args.status === "NOT_A_GAP") {
      patch.resolvedBy = admin._id;
      patch.resolvedAt = now;
    }
    if (args.status === "REVIEWING" && issue.status === "NEW") {
      patch.reviewedBy = admin._id;
    }

    await ctx.db.patch(args.issueId, patch);
    return args.issueId;
  },
});

/**
 * Backfill deterministico analytics da messaggi esistenti.
 * Idempotente: seconda esecuzione → 0 nuovi.
 * Non crea issue automatiche su storico incompleto.
 */
export const backfillAssistantAnalytics = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const limit = Math.min(Math.max(args.limit ?? 500, 1), 2000);

    const messages = await ctx.db
      .query("assistantMessages")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .take(limit * 3);

    const assistants = messages
      .filter((message) => message.role === "assistant")
      .slice(0, limit);

    let created = 0;
    let skipped = 0;

    for (const assistant of assistants) {
      const existing = await ctx.db
        .query("assistantInteractionAnalytics")
        .withIndex("by_assistant_message", (q) =>
          q.eq("assistantMessageId", assistant._id),
        )
        .unique();
      if (existing) {
        skipped += 1;
        continue;
      }

      const userMessageId = await findUserMessageForAssistant(ctx, assistant);
      if (!userMessageId) {
        skipped += 1;
        continue;
      }

      const sources = await ctx.db
        .query("assistantMessageSources")
        .withIndex("by_message", (q) =>
          q.eq("assistantMessageId", assistant._id),
        )
        .collect();

      await recordAssistantInteractionAnalytics(ctx, {
        conversationId: assistant.conversationId,
        userMessageId,
        assistantMessage: assistant,
        sources: sources.map((source) => ({
          categorySnapshot: source.categorySnapshot || "other",
          knowledgeCardId: source.knowledgeCardId,
        })),
        analyticsVersion: VM_INTELLIGENCE_BACKFILL_VERSION,
        createAutomaticIssues: false,
      });
      created += 1;
    }

    return { created, skipped, scanned: assistants.length };
  },
});
