import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireActiveUser, requireAdmin } from "./lib/authHelpers";
import { buildConversationTitleFromQuestion } from "../shared/assistant-context/index";

const privacyModeValidator = v.union(
  v.literal("patient_safe"),
  v.literal("internal"),
);

/**
 * TODO Auth0: identità da ctx.auth.
 */

export const createAssistantConversation = mutation({
  args: {
    currentUserId: v.id("appUsers"),
    title: v.optional(v.string()),
    simulationId: v.optional(v.id("simulations")),
    comparisonRunId: v.optional(v.id("simulationComparisonRuns")),
    privacyMode: v.optional(privacyModeValidator),
    firstQuestionHint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx, args.currentUserId);
    if (actor.role !== "cm") {
      throw new Error("Solo i Clinic Manager possono creare conversazioni.");
    }

    if (args.simulationId) {
      const simulation = await ctx.db.get(args.simulationId);
      if (!simulation) {
        throw new Error("Simulazione non trovata.");
      }
      if (simulation.ownerUserId !== args.currentUserId) {
        throw new Error("Non sei autorizzato su questa simulazione.");
      }
      if (args.comparisonRunId) {
        const run = await ctx.db.get(args.comparisonRunId);
        if (!run || run.simulationId !== args.simulationId) {
          throw new Error("Confronto non coerente con la simulazione.");
        }
      }
    }

    const now = Date.now();
    const title =
      args.title?.trim() ||
      (args.firstQuestionHint
        ? buildConversationTitleFromQuestion(args.firstQuestionHint)
        : "Nuova conversazione");

    return await ctx.db.insert("assistantConversations", {
      ownerUserId: args.currentUserId,
      title: title.slice(0, 60),
      simulationId: args.simulationId,
      comparisonRunId: args.comparisonRunId,
      privacyMode: args.privacyMode ?? "patient_safe",
      status: "active",
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listMyAssistantConversations = query({
  args: {
    currentUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx, args.currentUserId);
    const conversations = await ctx.db
      .query("assistantConversations")
      .withIndex("by_owner_updated_at", (q) =>
        q.eq("ownerUserId", args.currentUserId),
      )
      .order("desc")
      .collect();

    return conversations.filter((item) => {
      if (actor.role === "admin") return true;
      return item.ownerUserId === args.currentUserId;
    });
  },
});

export const getAssistantConversation = query({
  args: {
    currentUserId: v.id("appUsers"),
    conversationId: v.id("assistantConversations"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx, args.currentUserId);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;
    if (
      actor.role !== "admin" &&
      conversation.ownerUserId !== args.currentUserId
    ) {
      throw new Error("Non sei autorizzato a leggere questa conversazione.");
    }
    const simulation = conversation.simulationId
      ? await ctx.db.get(conversation.simulationId)
      : null;
    return {
      ...conversation,
      simulation: simulation
        ? {
            _id: simulation._id,
            network: simulation.network,
            status: simulation.status,
            requestedAmount: simulation.requestedAmount,
          }
        : null,
    };
  },
});

export const listAssistantMessages = query({
  args: {
    currentUserId: v.id("appUsers"),
    conversationId: v.id("assistantConversations"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx, args.currentUserId);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversazione non trovata.");
    }
    if (
      actor.role !== "admin" &&
      conversation.ownerUserId !== args.currentUserId
    ) {
      throw new Error("Non sei autorizzato.");
    }

    const messages = await ctx.db
      .query("assistantMessages")
      .withIndex("by_conversation_created_at", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc")
      .collect();

    const sources = await ctx.db
      .query("assistantMessageSources")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    const sourcesByMessage = new Map<string, typeof sources>();
    for (const source of sources) {
      const key = source.assistantMessageId;
      const list = sourcesByMessage.get(key) ?? [];
      list.push(source);
      sourcesByMessage.set(key, list);
    }

    return messages.map((message) => ({
      ...message,
      sources: (sourcesByMessage.get(message._id) ?? []).map((source) => ({
        knowledgeCardId: source.knowledgeCardId,
        knowledgeCardVersion: source.knowledgeCardVersion,
        titleSnapshot: source.titleSnapshot,
        categorySnapshot: source.categorySnapshot,
        // Score/matchReasons solo admin
        ...(actor.role === "admin"
          ? { score: source.score, matchReasons: source.matchReasons }
          : {}),
      })),
    }));
  },
});

export const archiveAssistantConversation = mutation({
  args: {
    currentUserId: v.id("appUsers"),
    conversationId: v.id("assistantConversations"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx, args.currentUserId);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversazione non trovata.");
    }
    if (actor.role === "admin") {
      throw new Error("L’admin non può modificare le conversazioni.");
    }
    if (conversation.ownerUserId !== args.currentUserId) {
      throw new Error("Non sei autorizzato.");
    }
    await ctx.db.patch(args.conversationId, {
      status: "archived",
      updatedAt: Date.now(),
    });
    return args.conversationId;
  },
});

export const updateAssistantConversationPrivacyMode = mutation({
  args: {
    currentUserId: v.id("appUsers"),
    conversationId: v.id("assistantConversations"),
    privacyMode: privacyModeValidator,
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx, args.currentUserId);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversazione non trovata.");
    }
    if (actor.role === "admin") {
      throw new Error("L’admin non può modificare le conversazioni.");
    }
    if (conversation.ownerUserId !== args.currentUserId) {
      throw new Error("Non sei autorizzato.");
    }
    await ctx.db.patch(args.conversationId, {
      privacyMode: args.privacyMode,
      updatedAt: Date.now(),
    });
    return args.conversationId;
  },
});

export const findConversationForSimulation = query({
  args: {
    currentUserId: v.id("appUsers"),
    simulationId: v.id("simulations"),
    comparisonRunId: v.optional(v.id("simulationComparisonRuns")),
  },
  handler: async (ctx, args) => {
    await requireActiveUser(ctx, args.currentUserId);
    const conversations = await ctx.db
      .query("assistantConversations")
      .withIndex("by_simulation", (q) => q.eq("simulationId", args.simulationId))
      .collect();

    const owned = conversations
      .filter(
        (item) =>
          item.ownerUserId === args.currentUserId && item.status === "active",
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (args.comparisonRunId) {
      const exact = owned.find(
        (item) => item.comparisonRunId === args.comparisonRunId,
      );
      if (exact) return exact;
    }
    return owned[0] ?? null;
  },
});

export const listAssistantConversationsAdmin = query({
  args: {
    actorUserId: v.id("appUsers"),
    knowledgeGapOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const conversations = await ctx.db.query("assistantConversations").collect();
    const users = await ctx.db.query("appUsers").collect();
    const userMap = new Map(users.map((user) => [user._id, user]));
    const messages = await ctx.db.query("assistantMessages").collect();

    const messagesByConversation = new Map<string, typeof messages>();
    for (const message of messages) {
      const list = messagesByConversation.get(message.conversationId) ?? [];
      list.push(message);
      messagesByConversation.set(message.conversationId, list);
    }

    const rows = conversations
      .map((conversation) => {
        const owner = userMap.get(conversation.ownerUserId);
        const conversationMessages =
          messagesByConversation.get(conversation._id) ?? [];
        const assistantMessages = conversationMessages.filter(
          (message) => message.role === "assistant",
        );
        const lastAssistant = [...assistantMessages].sort(
          (a, b) => b.createdAt - a.createdAt,
        )[0];
        const hasGap = assistantMessages.some(
          (message) =>
            message.outcome === "not_covered" ||
            message.outcome === "needs_information" ||
            message.requiresVerification === true ||
            message.status === "failed",
        );
        return {
          ...conversation,
          ownerDisplayName: owner?.displayName ?? "n/d",
          clinicName: owner?.clinicName,
          messageCount: conversationMessages.length,
          lastModel: lastAssistant?.model,
          lastProvider: lastAssistant?.provider,
          lastTotalTokens: lastAssistant?.totalTokens,
          lastStatus: lastAssistant?.status,
          lastErrorCode: lastAssistant?.errorCode,
          hasKnowledgeGap: hasGap,
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (args.knowledgeGapOnly) {
      return rows.filter((row) => row.hasKnowledgeGap);
    }
    return rows;
  },
});

export const getAssistantConversationAdmin = query({
  args: {
    actorUserId: v.id("appUsers"),
    conversationId: v.id("assistantConversations"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;
    const owner = await ctx.db.get(conversation.ownerUserId);
    const messages = await ctx.db
      .query("assistantMessages")
      .withIndex("by_conversation_created_at", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc")
      .collect();
    const sources = await ctx.db
      .query("assistantMessageSources")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();
    const sourcesByMessage = new Map<string, typeof sources>();
    for (const source of sources) {
      const list = sourcesByMessage.get(source.assistantMessageId) ?? [];
      list.push(source);
      sourcesByMessage.set(source.assistantMessageId, list);
    }

    return {
      conversation: {
        ...conversation,
        ownerDisplayName: owner?.displayName,
        clinicName: owner?.clinicName,
      },
      messages: messages.map((message) => ({
        ...message,
        sources: sourcesByMessage.get(message._id) ?? [],
      })),
    };
  },
});

export type ConversationId = Id<"assistantConversations">;
