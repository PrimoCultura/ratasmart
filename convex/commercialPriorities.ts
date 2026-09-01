import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isCurrentlyValid, requireAdmin } from "./lib/authHelpers";
import { networkValidator } from "./lib/financialValidation";

export const listCommercialPriorities = query({
  args: {},
  handler: async (ctx) => {
    const priorities = await ctx.db.query("commercialPriorities").collect();
    const companies = await ctx.db.query("financialCompanies").collect();
    const products = await ctx.db.query("financialProducts").collect();
    const tables = await ctx.db.query("financialTables").collect();

    const companyMap = new Map(companies.map((c) => [c._id, c]));
    const productMap = new Map(products.map((p) => [p._id, p]));
    const tableMap = new Map(tables.map((t) => [t._id, t]));

    return priorities
      .map((item) => ({
        ...item,
        company: item.companyId ? companyMap.get(item.companyId) ?? null : null,
        product: item.productId ? productMap.get(item.productId) ?? null : null,
        financialTable: item.financialTableId
          ? tableMap.get(item.financialTableId) ?? null
          : null,
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore || b.updatedAt - a.updatedAt);
  },
});

export const listActiveCommercialPriorities = query({
  args: {
    network: v.optional(networkValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const priorities = args.network
      ? await ctx.db
          .query("commercialPriorities")
          .withIndex("by_network_active", (q) =>
            q.eq("network", args.network!).eq("isActive", true),
          )
          .collect()
      : await ctx.db
          .query("commercialPriorities")
          .withIndex("by_is_active", (q) => q.eq("isActive", true))
          .collect();

    return priorities
      .filter((item) => isCurrentlyValid(now, item.validFrom, item.validTo))
      .sort((a, b) => b.priorityScore - a.priorityScore);
  },
});

export const createCommercialPriority = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    network: networkValidator,
    companyId: v.optional(v.id("financialCompanies")),
    productId: v.optional(v.id("financialProducts")),
    financialTableId: v.optional(v.id("financialTables")),
    label: v.string(),
    internalReason: v.optional(v.string()),
    visibleReason: v.optional(v.string()),
    priorityScore: v.number(),
    isActive: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const label = args.label.trim();
    if (!label) {
      throw new Error("L'etichetta è obbligatoria.");
    }
    if (!Number.isFinite(args.priorityScore)) {
      throw new Error("Il punteggio priorità non è valido.");
    }

    const now = Date.now();
    return await ctx.db.insert("commercialPriorities", {
      network: args.network,
      companyId: args.companyId,
      productId: args.productId,
      financialTableId: args.financialTableId,
      label,
      internalReason: args.internalReason?.trim() || undefined,
      visibleReason: args.visibleReason?.trim() || undefined,
      priorityScore: args.priorityScore,
      isActive: args.isActive,
      validFrom: args.validFrom,
      validTo: args.validTo,
      createdByUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCommercialPriority = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    priorityId: v.id("commercialPriorities"),
    network: networkValidator,
    companyId: v.optional(v.id("financialCompanies")),
    productId: v.optional(v.id("financialProducts")),
    financialTableId: v.optional(v.id("financialTables")),
    label: v.string(),
    internalReason: v.optional(v.string()),
    visibleReason: v.optional(v.string()),
    priorityScore: v.number(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const existing = await ctx.db.get(args.priorityId);
    if (!existing) {
      throw new Error("Priorità non trovata.");
    }

    const label = args.label.trim();
    if (!label) {
      throw new Error("L'etichetta è obbligatoria.");
    }

    await ctx.db.patch(args.priorityId, {
      network: args.network,
      companyId: args.companyId,
      productId: args.productId,
      financialTableId: args.financialTableId,
      label,
      internalReason: args.internalReason?.trim() || undefined,
      visibleReason: args.visibleReason?.trim() || undefined,
      priorityScore: args.priorityScore,
      validFrom: args.validFrom,
      validTo: args.validTo,
      updatedAt: Date.now(),
    });

    return args.priorityId;
  },
});

export const setCommercialPriorityActive = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    priorityId: v.id("commercialPriorities"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const existing = await ctx.db.get(args.priorityId);
    if (!existing) {
      throw new Error("Priorità non trovata.");
    }

    await ctx.db.patch(args.priorityId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    return args.priorityId;
  },
});

export const deleteCommercialPriority = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    priorityId: v.id("commercialPriorities"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const existing = await ctx.db.get(args.priorityId);
    if (!existing) {
      throw new Error("Priorità non trovata.");
    }

    await ctx.db.delete(args.priorityId);
    return true;
  },
});
