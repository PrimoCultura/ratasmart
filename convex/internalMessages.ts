import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isCurrentlyValid, requireAdmin } from "./lib/authHelpers";
import {
  iconTypeValidator,
  messageTypeValidator,
  networkValidator,
} from "./lib/financialValidation";

export const listInternalMessages = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("internalMessages").collect();
    const companies = await ctx.db.query("financialCompanies").collect();
    const products = await ctx.db.query("financialProducts").collect();
    const tables = await ctx.db.query("financialTables").collect();

    const companyMap = new Map(companies.map((c) => [c._id, c]));
    const productMap = new Map(products.map((p) => [p._id, p]));
    const tableMap = new Map(tables.map((t) => [t._id, t]));

    return messages
      .map((item) => ({
        ...item,
        company: item.companyId ? companyMap.get(item.companyId) ?? null : null,
        product: item.productId ? productMap.get(item.productId) ?? null : null,
        financialTable: item.financialTableId
          ? tableMap.get(item.financialTableId) ?? null
          : null,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const listActiveInternalMessages = query({
  args: {
    network: v.optional(networkValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const messages = args.network
      ? await ctx.db
          .query("internalMessages")
          .withIndex("by_network_active", (q) =>
            q.eq("network", args.network!).eq("isActive", true),
          )
          .collect()
      : await ctx.db
          .query("internalMessages")
          .withIndex("by_is_active", (q) => q.eq("isActive", true))
          .collect();

    return messages.filter((item) =>
      isCurrentlyValid(now, item.validFrom, item.validTo),
    );
  },
});

export const createInternalMessage = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    network: networkValidator,
    companyId: v.optional(v.id("financialCompanies")),
    productId: v.optional(v.id("financialProducts")),
    financialTableId: v.optional(v.id("financialTables")),
    title: v.string(),
    message: v.string(),
    messageType: messageTypeValidator,
    iconType: iconTypeValidator,
    requiresPrivacyConfirmation: v.boolean(),
    isActive: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const title = args.title.trim();
    const message = args.message.trim();
    if (!title || !message) {
      throw new Error("Titolo e messaggio sono obbligatori.");
    }

    const now = Date.now();
    return await ctx.db.insert("internalMessages", {
      network: args.network,
      companyId: args.companyId,
      productId: args.productId,
      financialTableId: args.financialTableId,
      title,
      message,
      messageType: args.messageType,
      iconType: args.iconType,
      requiresPrivacyConfirmation: args.requiresPrivacyConfirmation,
      isActive: args.isActive,
      validFrom: args.validFrom,
      validTo: args.validTo,
      createdByUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateInternalMessage = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    messageId: v.id("internalMessages"),
    network: networkValidator,
    companyId: v.optional(v.id("financialCompanies")),
    productId: v.optional(v.id("financialProducts")),
    financialTableId: v.optional(v.id("financialTables")),
    title: v.string(),
    message: v.string(),
    messageType: messageTypeValidator,
    iconType: iconTypeValidator,
    requiresPrivacyConfirmation: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const existing = await ctx.db.get(args.messageId);
    if (!existing) {
      throw new Error("Messaggio interno non trovato.");
    }

    const title = args.title.trim();
    const message = args.message.trim();
    if (!title || !message) {
      throw new Error("Titolo e messaggio sono obbligatori.");
    }

    await ctx.db.patch(args.messageId, {
      network: args.network,
      companyId: args.companyId,
      productId: args.productId,
      financialTableId: args.financialTableId,
      title,
      message,
      messageType: args.messageType,
      iconType: args.iconType,
      requiresPrivacyConfirmation: args.requiresPrivacyConfirmation,
      validFrom: args.validFrom,
      validTo: args.validTo,
      updatedAt: Date.now(),
    });

    return args.messageId;
  },
});

export const setInternalMessageActive = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    messageId: v.id("internalMessages"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const existing = await ctx.db.get(args.messageId);
    if (!existing) {
      throw new Error("Messaggio interno non trovato.");
    }

    await ctx.db.patch(args.messageId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    return args.messageId;
  },
});

export const deleteInternalMessage = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    messageId: v.id("internalMessages"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const existing = await ctx.db.get(args.messageId);
    if (!existing) {
      throw new Error("Messaggio interno non trovato.");
    }

    await ctx.db.delete(args.messageId);
    return true;
  },
});
