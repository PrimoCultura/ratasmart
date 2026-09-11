import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { isCurrentlyValid, requireAdmin } from "./lib/authHelpers";
import {
  normalizeKeywords,
  selectRelevantKnowledgeCards,
  formatKnowledgeContext,
  type RuntimeKnowledgeCard,
} from "../shared/knowledge-engine/index";

/**
 * TODO Auth0:
 * in produzione l’identità admin dovrà provenire da ctx.auth.
 */

export const knowledgeCategoryValidator = v.union(
  v.literal("documents"),
  v.literal("liquidation"),
  v.literal("invoicing"),
  v.literal("guarantor"),
  v.literal("income"),
  v.literal("invalidity_pension"),
  v.literal("employment"),
  v.literal("residence_permit"),
  v.literal("payment_methods"),
  v.literal("installment_date"),
  v.literal("extensions"),
  v.literal("rejected_practices"),
  v.literal("operational_alert"),
  v.literal("faq"),
  v.literal("other"),
);

export const knowledgeNetworkValidator = v.union(
  v.literal("PCG"),
  v.literal("DES"),
  v.literal("BOTH"),
);

async function assertScopeConsistency(
  ctx: MutationCtx,
  args: {
    companyId?: Id<"financialCompanies">;
    productId?: Id<"financialProducts">;
    financialTableId?: Id<"financialTables">;
  },
) {
  if (args.productId) {
    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error("Prodotto non trovato.");
    }
    if (args.companyId && product.companyId !== args.companyId) {
      throw new Error("Il prodotto non appartiene alla finanziaria selezionata.");
    }
  }

  if (args.financialTableId) {
    const table = await ctx.db.get(args.financialTableId);
    if (!table) {
      throw new Error("Tabella finanziaria non trovata.");
    }
    if (args.companyId && table.companyId !== args.companyId) {
      throw new Error("La tabella non appartiene alla finanziaria selezionata.");
    }
    if (args.productId && table.productId !== args.productId) {
      throw new Error("La tabella non appartiene al prodotto selezionato.");
    }
  }
}

function toRuntimeCard(card: {
  _id: string;
  title: string;
  content: string;
  category: string;
  network: "PCG" | "DES" | "BOTH";
  companyId?: string;
  productId?: string;
  financialTableId?: string;
  keywords: string[];
  priority: number;
  alwaysInclude: boolean;
  isAlert: boolean;
  alertLabel?: string;
  visibility?: "patient_safe" | "internal_only";
  isActive: boolean;
  validFrom?: number;
  validTo?: number;
  version: number;
  supersedesCardId?: string;
}): RuntimeKnowledgeCard {
  return {
    id: card._id,
    title: card.title,
    content: card.content,
    category: card.category,
    network: card.network,
    companyId: card.companyId,
    productId: card.productId,
    financialTableId: card.financialTableId,
    keywords: card.keywords,
    priority: card.priority,
    alwaysInclude: card.alwaysInclude,
    isAlert: card.isAlert,
    alertLabel: card.alertLabel,
    visibility: card.visibility,
    isActive: card.isActive,
    validFrom: card.validFrom,
    validTo: card.validTo,
    version: card.version,
    supersedesCardId: card.supersedesCardId,
  };
}

export const listKnowledgeCardsAdmin = query({
  args: {},
  handler: async (ctx) => {
    const cards = await ctx.db.query("knowledgeCards").collect();
    const companies = await ctx.db.query("financialCompanies").collect();
    const products = await ctx.db.query("financialProducts").collect();
    const tables = await ctx.db.query("financialTables").collect();

    const companyMap = new Map(companies.map((item) => [item._id, item]));
    const productMap = new Map(products.map((item) => [item._id, item]));
    const tableMap = new Map(tables.map((item) => [item._id, item]));

    return cards
      .map((card) => ({
        ...card,
        company: card.companyId ? companyMap.get(card.companyId) ?? null : null,
        product: card.productId ? productMap.get(card.productId) ?? null : null,
        financialTable: card.financialTableId
          ? tableMap.get(card.financialTableId) ?? null
          : null,
      }))
      .sort((a, b) => b.priority - a.priority || b.updatedAt - a.updatedAt);
  },
});

export const getKnowledgeCard = query({
  args: { cardId: v.id("knowledgeCards") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      return null;
    }
    const company = card.companyId ? await ctx.db.get(card.companyId) : null;
    const product = card.productId ? await ctx.db.get(card.productId) : null;
    const financialTable = card.financialTableId
      ? await ctx.db.get(card.financialTableId)
      : null;
    return { ...card, company, product, financialTable };
  },
});

export const listActiveKnowledgeCards = query({
  args: {
    network: v.optional(v.union(v.literal("PCG"), v.literal("DES"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cards = await ctx.db
      .query("knowledgeCards")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    return cards.filter((card) => {
      if (!isCurrentlyValid(now, card.validFrom, card.validTo)) {
        return false;
      }
      if (!args.network) {
        return true;
      }
      return card.network === "BOTH" || card.network === args.network;
    });
  },
});

export const listFaqKnowledgeCards = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cards = await ctx.db
      .query("knowledgeCards")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    return cards.filter(
      (card) =>
        card.showInFaq === true &&
        isCurrentlyValid(now, card.validFrom, card.validTo),
    );
  },
});

export const createKnowledgeCard = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    title: v.string(),
    content: v.string(),
    category: knowledgeCategoryValidator,
    network: knowledgeNetworkValidator,
    companyId: v.optional(v.id("financialCompanies")),
    productId: v.optional(v.id("financialProducts")),
    financialTableId: v.optional(v.id("financialTables")),
    keywords: v.array(v.string()),
    priority: v.number(),
    alwaysInclude: v.boolean(),
    isAlert: v.boolean(),
    alertLabel: v.optional(v.string()),
    visibility: v.optional(
      v.union(v.literal("patient_safe"), v.literal("internal_only")),
    ),
    sourceReference: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
    showInFaq: v.optional(v.boolean()),
    faqQuestion: v.optional(v.string()),
    faqCategory: v.optional(v.string()),
    faqOrder: v.optional(v.number()),
    isActive: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l’identità admin dovrà provenire da ctx.auth.
    await requireAdmin(ctx, args.actorUserId);

    const title = args.title.trim();
    const content = args.content.trim();
    if (!title || !content) {
      throw new Error("Titolo e contenuto sono obbligatori.");
    }
    if (args.priority < 0 || args.priority > 100) {
      throw new Error("La priorità deve essere compresa tra 0 e 100.");
    }

    await assertScopeConsistency(ctx, args);

    const now = Date.now();
    return await ctx.db.insert("knowledgeCards", {
      title,
      content,
      category: args.category,
      network: args.network,
      companyId: args.companyId,
      productId: args.productId,
      financialTableId: args.financialTableId,
      keywords: normalizeKeywords(args.keywords),
      priority: args.priority,
      alwaysInclude: args.alwaysInclude,
      isAlert: args.isAlert,
      alertLabel: args.alertLabel?.trim() || undefined,
      visibility: args.visibility ?? "internal_only",
      sourceReference: args.sourceReference?.trim() || undefined,
      adminNotes: args.adminNotes?.trim() || undefined,
      showInFaq: args.showInFaq ?? false,
      faqQuestion: args.faqQuestion?.trim() || undefined,
      faqCategory: args.faqCategory?.trim() || undefined,
      faqOrder: args.faqOrder,
      isActive: args.isActive,
      validFrom: args.validFrom,
      validTo: args.validTo,
      version: 1,
      createdByUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateKnowledgeCardMetadata = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    cardId: v.id("knowledgeCards"),
    keywords: v.optional(v.array(v.string())),
    priority: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
    adminNotes: v.optional(v.string()),
    sourceReference: v.optional(v.string()),
    alwaysInclude: v.optional(v.boolean()),
    isAlert: v.optional(v.boolean()),
    alertLabel: v.optional(v.string()),
    showInFaq: v.optional(v.boolean()),
    faqQuestion: v.optional(v.string()),
    faqCategory: v.optional(v.string()),
    faqOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l’identità admin dovrà provenire da ctx.auth.
    await requireAdmin(ctx, args.actorUserId);
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      throw new Error("Scheda non trovata.");
    }
    if (args.priority !== undefined && (args.priority < 0 || args.priority > 100)) {
      throw new Error("La priorità deve essere compresa tra 0 e 100.");
    }

    await ctx.db.patch(args.cardId, {
      keywords:
        args.keywords !== undefined
          ? normalizeKeywords(args.keywords)
          : card.keywords,
      priority: args.priority ?? card.priority,
      isActive: args.isActive ?? card.isActive,
      validFrom:
        args.validFrom !== undefined ? args.validFrom : card.validFrom,
      validTo: args.validTo !== undefined ? args.validTo : card.validTo,
      adminNotes:
        args.adminNotes !== undefined
          ? args.adminNotes.trim() || undefined
          : card.adminNotes,
      sourceReference:
        args.sourceReference !== undefined
          ? args.sourceReference.trim() || undefined
          : card.sourceReference,
      alwaysInclude: args.alwaysInclude ?? card.alwaysInclude,
      isAlert: args.isAlert ?? card.isAlert,
      alertLabel:
        args.alertLabel !== undefined
          ? args.alertLabel.trim() || undefined
          : card.alertLabel,
      showInFaq: args.showInFaq ?? card.showInFaq ?? false,
      faqQuestion:
        args.faqQuestion !== undefined
          ? args.faqQuestion.trim() || undefined
          : card.faqQuestion,
      faqCategory:
        args.faqCategory !== undefined
          ? args.faqCategory.trim() || undefined
          : card.faqCategory,
      faqOrder:
        args.faqOrder !== undefined ? args.faqOrder : card.faqOrder,
      updatedAt: Date.now(),
    });
    return args.cardId;
  },
});

export const createKnowledgeCardVersion = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    supersedesCardId: v.id("knowledgeCards"),
    title: v.string(),
    content: v.string(),
    category: knowledgeCategoryValidator,
    network: knowledgeNetworkValidator,
    companyId: v.optional(v.id("financialCompanies")),
    productId: v.optional(v.id("financialProducts")),
    financialTableId: v.optional(v.id("financialTables")),
    keywords: v.array(v.string()),
    priority: v.number(),
    alwaysInclude: v.boolean(),
    isAlert: v.boolean(),
    alertLabel: v.optional(v.string()),
    visibility: v.optional(
      v.union(v.literal("patient_safe"), v.literal("internal_only")),
    ),
    sourceReference: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
    showInFaq: v.optional(v.boolean()),
    faqQuestion: v.optional(v.string()),
    faqCategory: v.optional(v.string()),
    faqOrder: v.optional(v.number()),
    isActive: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l’identità admin dovrà provenire da ctx.auth.
    await requireAdmin(ctx, args.actorUserId);
    const previous = await ctx.db.get(args.supersedesCardId);
    if (!previous) {
      throw new Error("Scheda da versionare non trovata.");
    }

    const title = args.title.trim();
    const content = args.content.trim();
    if (!title || !content) {
      throw new Error("Titolo e contenuto sono obbligatori.");
    }
    if (args.priority < 0 || args.priority > 100) {
      throw new Error("La priorità deve essere compresa tra 0 e 100.");
    }

    await assertScopeConsistency(ctx, args);

    const now = Date.now();
    if (args.isActive && previous.isActive) {
      await ctx.db.patch(previous._id, { isActive: false, updatedAt: now });
    }

    return await ctx.db.insert("knowledgeCards", {
      title,
      content,
      category: args.category,
      network: args.network,
      companyId: args.companyId,
      productId: args.productId,
      financialTableId: args.financialTableId,
      keywords: normalizeKeywords(args.keywords),
      priority: args.priority,
      alwaysInclude: args.alwaysInclude,
      isAlert: args.isAlert,
      alertLabel: args.alertLabel?.trim() || undefined,
      visibility: args.visibility ?? previous.visibility ?? "internal_only",
      sourceReference: args.sourceReference?.trim() || undefined,
      adminNotes: args.adminNotes?.trim() || undefined,
      showInFaq: args.showInFaq ?? previous.showInFaq ?? false,
      faqQuestion:
        args.faqQuestion?.trim() || previous.faqQuestion || undefined,
      faqCategory:
        args.faqCategory?.trim() || previous.faqCategory || undefined,
      faqOrder: args.faqOrder ?? previous.faqOrder,
      isActive: args.isActive,
      validFrom: args.validFrom,
      validTo: args.validTo,
      version: previous.version + 1,
      supersedesCardId: previous._id,
      createdByUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const setKnowledgeCardActive = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    cardId: v.id("knowledgeCards"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l’identità admin dovrà provenire da ctx.auth.
    await requireAdmin(ctx, args.actorUserId);
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      throw new Error("Scheda non trovata.");
    }
    await ctx.db.patch(args.cardId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
    return args.cardId;
  },
});

/**
 * Cancellazione fisica consentita solo se:
 * - nessuna versione successiva;
 * - non utilizzata dalla chat (assistantMessageSources).
 */
export const deleteKnowledgeCardIfUnused = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    cardId: v.id("knowledgeCards"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l’identità admin dovrà provenire da ctx.auth.
    await requireAdmin(ctx, args.actorUserId);
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      throw new Error("Scheda non trovata.");
    }

    const all = await ctx.db.query("knowledgeCards").collect();
    const hasSuccessor = all.some(
      (item) => item.supersedesCardId === args.cardId,
    );
    if (hasSuccessor) {
      throw new Error(
        "Impossibile eliminare: esiste una versione successiva. Preferire la disattivazione.",
      );
    }

    const sources = await ctx.db
      .query("assistantMessageSources")
      .withIndex("by_knowledge_card", (q) =>
        q.eq("knowledgeCardId", args.cardId),
      )
      .take(1);
    if (sources.length > 0) {
      throw new Error(
        "Impossibile eliminare: la scheda risulta fornita a Virtual Marco in almeno una conversazione. Preferire la disattivazione; lo storico resta consultabile.",
      );
    }

    await ctx.db.delete(args.cardId);
    return true;
  },
});

export const previewKnowledgeContext = query({
  args: {
    actorUserId: v.id("appUsers"),
    network: v.union(v.literal("PCG"), v.literal("DES")),
    companyId: v.optional(v.id("financialCompanies")),
    productId: v.optional(v.id("financialProducts")),
    financialTableId: v.optional(v.id("financialTables")),
    userQuestion: v.optional(v.string()),
    privacyMode: v.optional(
      v.union(v.literal("patient_safe"), v.literal("internal")),
    ),
    maxCards: v.optional(v.number()),
    maxCharacters: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l’identità admin dovrà provenire da ctx.auth.
    await requireAdmin(ctx, args.actorUserId);

    const now = Date.now();
    const cards = await ctx.db
      .query("knowledgeCards")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    const runtimeCards = cards
      .filter((card) => isCurrentlyValid(now, card.validFrom, card.validTo))
      .map((card) =>
        toRuntimeCard({
          ...card,
          companyId: card.companyId,
          productId: card.productId,
          financialTableId: card.financialTableId,
        }),
      );

    const selection = selectRelevantKnowledgeCards(
      runtimeCards,
      {
        network: args.network,
        companyId: args.companyId,
        productId: args.productId,
        financialTableId: args.financialTableId,
        userQuestion: args.userQuestion,
        calculationDate: now,
        privacyMode: args.privacyMode ?? "internal",
      },
      {
        maxCards: args.maxCards,
        maxCharacters: args.maxCharacters,
      },
    );

    return {
      ...selection,
      contextText: formatKnowledgeContext(selection.selectedCards),
    };
  },
});
