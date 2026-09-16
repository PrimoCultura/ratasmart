import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireActiveUser } from "./lib/authHelpers";
import { upsertKnowledgeIssueCandidate } from "./lib/vmIntelligence";

const feedbackTypeValidator = v.union(
  v.literal("HELPFUL"),
  v.literal("NOT_HELPFUL"),
  v.literal("INCORRECT_INFORMATION"),
  v.literal("MISSING_INFORMATION"),
);

/**
 * Feedback CM su risposta Virtual Marco.
 * Un feedback corrente per utente/messaggio (upsert).
 */
export const upsertAssistantFeedback = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    assistantMessageId: v.id("assistantMessages"),
    feedbackType: feedbackTypeValidator,
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx, args.actorUserId);
    const message = await ctx.db.get(args.assistantMessageId);
    if (!message || message.role !== "assistant") {
      throw new Error("Messaggio assistant non trovato.");
    }
    if (message.ownerUserId !== actor._id && actor.role !== "admin") {
      throw new Error("Non sei autorizzato a lasciare feedback su questo messaggio.");
    }
    if (message.status !== "completed") {
      throw new Error("Feedback disponibile solo su risposte completate.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("assistantFeedback")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", actor._id).eq("assistantMessageId", args.assistantMessageId),
      )
      .unique();

    const comment =
      args.feedbackType === "HELPFUL"
        ? undefined
        : args.comment?.trim() || undefined;

    let feedbackId = existing?._id;
    if (existing) {
      await ctx.db.patch(existing._id, {
        feedbackType: args.feedbackType,
        comment,
        updatedAt: now,
      });
    } else {
      feedbackId = await ctx.db.insert("assistantFeedback", {
        assistantMessageId: args.assistantMessageId,
        conversationId: message.conversationId,
        userId: actor._id,
        feedbackType: args.feedbackType,
        comment,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Candidate knowledge issues da feedback negativo strutturato.
    if (
      args.feedbackType === "INCORRECT_INFORMATION" ||
      args.feedbackType === "MISSING_INFORMATION"
    ) {
      const reason =
        args.feedbackType === "INCORRECT_INFORMATION"
          ? "USER_REPORTS_INCORRECT_INFORMATION"
          : "USER_REPORTS_MISSING_INFORMATION";

      const analytics = await ctx.db
        .query("assistantInteractionAnalytics")
        .withIndex("by_assistant_message", (q) =>
          q.eq("assistantMessageId", args.assistantMessageId),
        )
        .unique();

      const siblings = await ctx.db
        .query("assistantMessages")
        .withIndex("by_request_id", (q) => q.eq("requestId", message.requestId))
        .collect();
      const userMessage = siblings.find((item) => item.role === "user");

      if (userMessage) {
        await upsertKnowledgeIssueCandidate(ctx, {
          conversationId: message.conversationId,
          userMessageId: userMessage._id,
          assistantMessageId: args.assistantMessageId,
          topic: analytics?.primaryTopic ?? "OTHER",
          network: analytics?.network,
          companyCodes: analytics?.companyCodes ?? [],
          productCodes: analytics?.productCodes ?? [],
          detectedBy: "USER_FEEDBACK",
          primaryReasonCode: reason,
          reasonCodes: [reason],
        });
      }
    }

    return feedbackId;
  },
});

export const getMyFeedbackForMessage = query({
  args: {
    actorUserId: v.id("appUsers"),
    assistantMessageId: v.id("assistantMessages"),
  },
  handler: async (ctx, args) => {
    await requireActiveUser(ctx, args.actorUserId);
    return await ctx.db
      .query("assistantFeedback")
      .withIndex("by_user_message", (q) =>
        q
          .eq("userId", args.actorUserId)
          .eq("assistantMessageId", args.assistantMessageId),
      )
      .unique();
  },
});

export const listMyFeedbackForMessages = query({
  args: {
    actorUserId: v.id("appUsers"),
    assistantMessageIds: v.array(v.id("assistantMessages")),
  },
  handler: async (ctx, args) => {
    await requireActiveUser(ctx, args.actorUserId);
    const result: Record<string, string> = {};
    for (const messageId of args.assistantMessageIds.slice(0, 100)) {
      const feedback = await ctx.db
        .query("assistantFeedback")
        .withIndex("by_user_message", (q) =>
          q.eq("userId", args.actorUserId).eq("assistantMessageId", messageId),
        )
        .unique();
      if (feedback) {
        result[messageId] = feedback.feedbackType;
      }
    }
    return result;
  },
});
