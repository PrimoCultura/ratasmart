import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  classifyKnowledgeCoverage,
  deriveCandidateIssueReasons,
  deriveTopics,
  VM_INTELLIGENCE_ANALYTICS_VERSION,
  VM_INTELLIGENCE_BACKFILL_VERSION,
  type CandidateIssueReasonCode,
} from "../../shared/virtual-marco-intelligence";

type DbCtx = MutationCtx | QueryCtx;

type Network = "PCG" | "DES" | "Paoleschi";

/**
 * Registra analytics + eventuali candidate issues.
 * Idempotente su assistantMessageId. Non deve mai far fallire il turn chat.
 */
export async function recordAssistantInteractionAnalytics(
  ctx: MutationCtx,
  input: {
    conversationId: Id<"assistantConversations">;
    userMessageId: Id<"assistantMessages">;
    assistantMessage: Doc<"assistantMessages">;
    sources: Array<{
      categorySnapshot: string;
      knowledgeCardId: Id<"knowledgeCards">;
    }>;
    analyticsVersion?: string;
    createAutomaticIssues?: boolean;
  },
): Promise<{ analyticsId: Id<"assistantInteractionAnalytics"> | null }> {
  const existing = await ctx.db
    .query("assistantInteractionAnalytics")
    .withIndex("by_assistant_message", (q) =>
      q.eq("assistantMessageId", input.assistantMessage._id),
    )
    .unique();
  if (existing) {
    return { analyticsId: existing._id };
  }

  const intents = input.assistantMessage.preScreeningIntents ?? [];
  const sourceCategories = input.sources.map((source) => source.categorySnapshot);
  const companyCodes = (input.assistantMessage.matchedCompanyIds ?? []).map(
    (id) => String(id),
  );

  // Product codes: da knowledge cards collegate se disponibili
  const productCodes: string[] = [];
  for (const source of input.sources) {
    const card = await ctx.db.get(source.knowledgeCardId);
    if (card?.productId) {
      const code = String(card.productId);
      if (!productCodes.includes(code)) productCodes.push(code);
    }
    if (card?.companyId) {
      const code = String(card.companyId);
      if (!companyCodes.includes(code)) companyCodes.push(code);
    }
  }

  let network: Network | undefined;
  const simulationId =
    input.assistantMessage.simulationId ??
    (await ctx.db.get(input.conversationId))?.simulationId;
  if (simulationId) {
    const simulation = await ctx.db.get(simulationId);
    if (simulation) network = simulation.network;
  }

  const { primaryTopic, topicCodes } = deriveTopics({
    sourceCategories,
    intents,
    hasCompanyMatch: companyCodes.length > 0,
  });

  const sourceCount = input.sources.length;
  const coverage = classifyKnowledgeCoverage({
    sourceCount,
    intents,
    outcome: input.assistantMessage.outcome,
  });
  const requiresVerification =
    input.assistantMessage.requiresVerification === true;
  const candidateIssueReasonCodes = deriveCandidateIssueReasons({
    coverage,
    requiresVerification,
  });

  const hasKbSource = sourceCount > 0;
  const hasSimulationSource = simulationId !== undefined;

  const analyticsId = await ctx.db.insert("assistantInteractionAnalytics", {
    conversationId: input.conversationId,
    userMessageId: input.userMessageId,
    assistantMessageId: input.assistantMessage._id,
    userId: input.assistantMessage.ownerUserId,
    simulationId,
    network,
    createdAt:
      input.assistantMessage.completedAt ??
      input.assistantMessage.createdAt ??
      Date.now(),
    primaryTopic,
    topicCodes,
    companyCodes,
    productCodes,
    intentCodes: intents,
    sourceCount,
    hasKnowledgeSource: hasKbSource,
    hasKbSource,
    hasPolicySource: false,
    hasSimulationSource,
    requiresVerification,
    knowledgeCoverageStatus: coverage,
    candidateIssueReasonCodes,
    analyticsVersion:
      input.analyticsVersion ?? VM_INTELLIGENCE_ANALYTICS_VERSION,
  });

  if (input.createAutomaticIssues !== false) {
    for (const reason of candidateIssueReasonCodes) {
      await upsertKnowledgeIssueCandidate(ctx, {
        conversationId: input.conversationId,
        userMessageId: input.userMessageId,
        assistantMessageId: input.assistantMessage._id,
        topic: primaryTopic,
        network,
        companyCodes,
        productCodes,
        detectedBy: "AUTOMATIC_RULE",
        primaryReasonCode: reason,
        reasonCodes: [reason],
        linkedKnowledgeCardId: input.sources[0]?.knowledgeCardId,
      });
    }
  }

  return { analyticsId };
}

export async function upsertKnowledgeIssueCandidate(
  ctx: MutationCtx,
  input: {
    conversationId: Id<"assistantConversations">;
    userMessageId: Id<"assistantMessages">;
    assistantMessageId: Id<"assistantMessages">;
    topic: string;
    network?: Network;
    companyCodes: string[];
    productCodes: string[];
    detectedBy: "AUTOMATIC_RULE" | "USER_FEEDBACK" | "ADMIN";
    primaryReasonCode: string;
    reasonCodes: string[];
    linkedKnowledgeCardId?: Id<"knowledgeCards">;
  },
) {
  const existing = await ctx.db
    .query("knowledgeIssues")
    .withIndex("by_message_reason", (q) =>
      q
        .eq("assistantMessageId", input.assistantMessageId)
        .eq("primaryReasonCode", input.primaryReasonCode),
    )
    .unique();

  if (existing) {
    // Non ricreare; se era risolto/non-gap non riaprire automaticamente.
    if (
      existing.status === "RESOLVED" ||
      existing.status === "NOT_A_GAP" ||
      existing.status === "CONFIRMED_GAP" ||
      existing.status === "CONTENT_ERROR"
    ) {
      return existing._id;
    }
    const mergedReasons = [
      ...new Set([...existing.reasonCodes, ...input.reasonCodes]),
    ];
    await ctx.db.patch(existing._id, {
      reasonCodes: mergedReasons,
      updatedAt: Date.now(),
      companyCodes:
        input.companyCodes.length > 0
          ? input.companyCodes
          : existing.companyCodes,
      productCodes:
        input.productCodes.length > 0
          ? input.productCodes
          : existing.productCodes,
    });
    return existing._id;
  }

  const now = Date.now();
  return await ctx.db.insert("knowledgeIssues", {
    conversationId: input.conversationId,
    userMessageId: input.userMessageId,
    assistantMessageId: input.assistantMessageId,
    topic: input.topic,
    network: input.network,
    companyCodes: input.companyCodes,
    productCodes: input.productCodes,
    detectedBy: input.detectedBy,
    reasonCodes: input.reasonCodes,
    primaryReasonCode: input.primaryReasonCode,
    status: "NEW",
    createdAt: now,
    updatedAt: now,
    linkedKnowledgeCardId: input.linkedKnowledgeCardId,
  });
}

export async function findUserMessageForAssistant(
  ctx: DbCtx,
  assistantMessage: Doc<"assistantMessages">,
): Promise<Id<"assistantMessages"> | null> {
  const siblings = await ctx.db
    .query("assistantMessages")
    .withIndex("by_request_id", (q) =>
      q.eq("requestId", assistantMessage.requestId),
    )
    .collect();
  const user = siblings.find((item) => item.role === "user");
  return user?._id ?? null;
}

export { VM_INTELLIGENCE_BACKFILL_VERSION };
export type { CandidateIssueReasonCode };
