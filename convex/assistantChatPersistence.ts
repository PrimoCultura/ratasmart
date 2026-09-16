import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { recordAssistantInteractionAnalytics } from "./lib/vmIntelligence";

const privacyModeValidator = v.union(
  v.literal("patient_safe"),
  v.literal("internal"),
);

const outcomeValidator = v.union(
  v.literal("answered"),
  v.literal("needs_information"),
  v.literal("requires_verification"),
  v.literal("not_covered"),
);

const verificationTargetValidator = v.union(
  v.literal("none"),
  v.literal("area_manager"),
  v.literal("financial_company"),
  v.literal("both"),
);

/**
 * Crea messaggio user + assistant pending in modo idempotente su requestId.
 */
export const beginAssistantTurn = internalMutation({
  args: {
    conversationId: v.id("assistantConversations"),
    ownerUserId: v.id("appUsers"),
    requestId: v.string(),
    message: v.string(),
    privacyMode: privacyModeValidator,
    simulationId: v.optional(v.id("simulations")),
    comparisonRunId: v.optional(v.id("simulationComparisonRuns")),
    titleIfDefault: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("assistantMessages")
      .withIndex("by_request_id", (q) => q.eq("requestId", args.requestId))
      .collect();

    if (existing.length > 0) {
      const userMessage = existing.find((item) => item.role === "user");
      const assistantMessage = existing.find((item) => item.role === "assistant");
      return {
        wasDuplicate: true as const,
        userMessageId: userMessage?._id,
        assistantMessageId: assistantMessage?._id,
        assistantStatus: assistantMessage?.status,
        assistantContent: assistantMessage?.content,
        outcome: assistantMessage?.outcome,
        alerts: assistantMessage?.alerts,
        missingInformation: assistantMessage?.missingInformation,
        requiresVerification: assistantMessage?.requiresVerification,
        verificationTarget: assistantMessage?.verificationTarget,
        errorCode: assistantMessage?.errorCode,
        errorMessage: assistantMessage?.errorMessage,
      };
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversazione non trovata.");
    }
    if (conversation.ownerUserId !== args.ownerUserId) {
      throw new Error("Owner conversazione non coerente.");
    }

    const now = Date.now();
    const userMessageId = await ctx.db.insert("assistantMessages", {
      conversationId: args.conversationId,
      ownerUserId: args.ownerUserId,
      role: "user",
      content: args.message,
      status: "completed",
      requestId: args.requestId,
      privacyMode: args.privacyMode,
      simulationId: args.simulationId,
      comparisonRunId: args.comparisonRunId,
      createdAt: now,
      completedAt: now,
    });

    const assistantMessageId = await ctx.db.insert("assistantMessages", {
      conversationId: args.conversationId,
      ownerUserId: args.ownerUserId,
      role: "assistant",
      content: "",
      status: "pending",
      requestId: args.requestId,
      privacyMode: args.privacyMode,
      simulationId: args.simulationId,
      comparisonRunId: args.comparisonRunId,
      createdAt: now,
    });

    const patch: {
      lastMessageAt: number;
      updatedAt: number;
      title?: string;
    } = {
      lastMessageAt: now,
      updatedAt: now,
    };
    if (
      args.titleIfDefault &&
      (conversation.title === "Nuova conversazione" || !conversation.title)
    ) {
      patch.title = args.titleIfDefault.slice(0, 60);
    }

    await ctx.db.patch(args.conversationId, patch);

    return {
      wasDuplicate: false as const,
      userMessageId,
      assistantMessageId,
    };
  },
});

export const completeAssistantTurn = internalMutation({
  args: {
    assistantMessageId: v.id("assistantMessages"),
    conversationId: v.id("assistantConversations"),
    content: v.string(),
    outcome: outcomeValidator,
    requiresVerification: v.boolean(),
    verificationTarget: verificationTargetValidator,
    alerts: v.array(v.string()),
    missingInformation: v.array(v.string()),
    assistantConfigId: v.id("assistantConfigs"),
    assistantConfigVersion: v.number(),
    provider: v.string(),
    model: v.string(),
    providerResponseId: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    sources: v.array(
      v.object({
        knowledgeCardId: v.id("knowledgeCards"),
        knowledgeCardVersion: v.number(),
        titleSnapshot: v.string(),
        categorySnapshot: v.string(),
        score: v.number(),
        matchReasons: v.array(v.string()),
      }),
    ),
    usedPreScreeningContext: v.optional(v.boolean()),
    preScreeningIntents: v.optional(v.array(v.string())),
    matchedCompanyIds: v.optional(v.array(v.id("financialCompanies"))),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.assistantMessageId);
    if (!message) {
      throw new Error("Messaggio assistant non trovato.");
    }
    if (message.status === "completed") {
      return { alreadyCompleted: true as const };
    }

    const now = Date.now();
    await ctx.db.patch(args.assistantMessageId, {
      content: args.content,
      status: "completed",
      outcome: args.outcome,
      requiresVerification: args.requiresVerification,
      verificationTarget: args.verificationTarget,
      alerts: args.alerts,
      missingInformation: args.missingInformation,
      assistantConfigId: args.assistantConfigId,
      assistantConfigVersion: args.assistantConfigVersion,
      provider: args.provider,
      model: args.model,
      providerResponseId: args.providerResponseId,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: args.totalTokens,
      knowledgeCardsProvided: args.sources.length,
      usedPreScreeningContext: args.usedPreScreeningContext,
      preScreeningIntents: args.preScreeningIntents,
      matchedCompanyIds: args.matchedCompanyIds,
      completedAt: now,
      errorCode: undefined,
      errorMessage: undefined,
    });

    for (const source of args.sources) {
      await ctx.db.insert("assistantMessageSources", {
        assistantMessageId: args.assistantMessageId,
        conversationId: args.conversationId,
        knowledgeCardId: source.knowledgeCardId,
        knowledgeCardVersion: source.knowledgeCardVersion,
        titleSnapshot: source.titleSnapshot,
        categorySnapshot: source.categorySnapshot,
        score: source.score,
        matchReasons: source.matchReasons,
        createdAt: now,
      });
    }

    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      updatedAt: now,
    });

    // Analytics side-effect: non blocca / non fallisce il turn chat.
    try {
      const siblings = await ctx.db
        .query("assistantMessages")
        .withIndex("by_request_id", (q) => q.eq("requestId", message.requestId))
        .collect();
      const userMessage = siblings.find((item) => item.role === "user");
      const refreshed = await ctx.db.get(args.assistantMessageId);
      if (userMessage && refreshed) {
        await recordAssistantInteractionAnalytics(ctx, {
          conversationId: args.conversationId,
          userMessageId: userMessage._id,
          assistantMessage: refreshed,
          sources: args.sources.map((source) => ({
            categorySnapshot: source.categorySnapshot,
            knowledgeCardId: source.knowledgeCardId,
          })),
          createAutomaticIssues: true,
        });
      }
    } catch {
      // swallow: la risposta Virtual Marco resta disponibile
    }

    return { alreadyCompleted: false as const };
  },
});

export const failAssistantTurn = internalMutation({
  args: {
    assistantMessageId: v.id("assistantMessages"),
    conversationId: v.id("assistantConversations"),
    errorCode: v.string(),
    errorMessage: v.string(),
    assistantConfigId: v.optional(v.id("assistantConfigs")),
    assistantConfigVersion: v.optional(v.number()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.assistantMessageId);
    if (!message) {
      throw new Error("Messaggio assistant non trovato.");
    }
    if (message.status === "completed") {
      return;
    }
    const now = Date.now();
    await ctx.db.patch(args.assistantMessageId, {
      status: "failed",
      content:
        "Virtual Marco non è riuscito a completare la risposta. Riprova oppure verifica la configurazione con l’amministratore.",
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      assistantConfigId: args.assistantConfigId,
      assistantConfigVersion: args.assistantConfigVersion,
      provider: args.provider,
      model: args.model,
      completedAt: now,
    });
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      updatedAt: now,
    });
  },
});

export type SourceInsert = {
  knowledgeCardId: Id<"knowledgeCards">;
  knowledgeCardVersion: number;
  titleSnapshot: string;
  categorySnapshot: string;
  score: number;
  matchReasons: string[];
};
