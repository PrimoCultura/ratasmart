import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/authHelpers";

/**
 * TODO Auth0:
 * in produzione l’identità admin dovrà provenire da ctx.auth.
 */

export const listAssistantConfigs = query({
  args: {},
  handler: async (ctx) => {
    const configs = await ctx.db.query("assistantConfigs").collect();
    return configs.sort((a, b) => b.version - a.version || b.updatedAt - a.updatedAt);
  },
});

export const getActiveAssistantConfig = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("assistantConfigs")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
    return active[0] ?? null;
  },
});

export const getAssistantConfig = query({
  args: { configId: v.id("assistantConfigs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.configId);
  },
});

export const createAssistantConfigVersion = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    name: v.string(),
    behaviorPrompt: v.string(),
    modelProvider: v.string(),
    modelName: v.string(),
    temperature: v.number(),
    maxOutputTokens: v.number(),
    adminNotes: v.optional(v.string()),
    activate: v.optional(v.boolean()),
    supersedesConfigId: v.optional(v.id("assistantConfigs")),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l’identità admin dovrà provenire da ctx.auth.
    await requireAdmin(ctx, args.actorUserId);

    const name = args.name.trim();
    const behaviorPrompt = args.behaviorPrompt.trim();
    if (!name) {
      throw new Error("Il nome della configurazione è obbligatorio.");
    }
    if (!behaviorPrompt) {
      throw new Error("Il prompt di comportamento è obbligatorio.");
    }
    if (args.temperature < 0 || args.temperature > 2) {
      throw new Error("La temperatura deve essere compresa tra 0 e 2.");
    }
    if (args.maxOutputTokens <= 0) {
      throw new Error("maxOutputTokens deve essere maggiore di zero.");
    }

    const existing = await ctx.db.query("assistantConfigs").collect();
    const maxVersion = existing.reduce(
      (max, item) => Math.max(max, item.version),
      0,
    );
    const now = Date.now();
    const activate = args.activate ?? true;

    if (activate) {
      for (const item of existing.filter((config) => config.isActive)) {
        await ctx.db.patch(item._id, { isActive: false, updatedAt: now });
      }
    }

    return await ctx.db.insert("assistantConfigs", {
      name,
      behaviorPrompt,
      modelProvider: args.modelProvider.trim() || "openai",
      modelName: args.modelName.trim() || "gpt-5.6-luna",
      temperature: args.temperature,
      maxOutputTokens: args.maxOutputTokens,
      isActive: activate,
      version: maxVersion + 1,
      supersedesConfigId: args.supersedesConfigId,
      adminNotes: args.adminNotes?.trim() || undefined,
      createdByUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateAssistantConfigMetadata = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    configId: v.id("assistantConfigs"),
    adminNotes: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l’identità admin dovrà provenire da ctx.auth.
    await requireAdmin(ctx, args.actorUserId);
    const config = await ctx.db.get(args.configId);
    if (!config) {
      throw new Error("Configurazione non trovata.");
    }

    await ctx.db.patch(args.configId, {
      adminNotes:
        args.adminNotes !== undefined
          ? args.adminNotes.trim() || undefined
          : config.adminNotes,
      name: args.name !== undefined ? args.name.trim() || config.name : config.name,
      updatedAt: Date.now(),
    });
    return args.configId;
  },
});

export const activateAssistantConfig = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    configId: v.id("assistantConfigs"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l’identità admin dovrà provenire da ctx.auth.
    await requireAdmin(ctx, args.actorUserId);
    const config = await ctx.db.get(args.configId);
    if (!config) {
      throw new Error("Configurazione non trovata.");
    }

    const now = Date.now();
    const active = await ctx.db
      .query("assistantConfigs")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
    for (const item of active) {
      if (item._id !== args.configId) {
        await ctx.db.patch(item._id, { isActive: false, updatedAt: now });
      }
    }

    await ctx.db.patch(args.configId, { isActive: true, updatedAt: now });
    return args.configId;
  },
});
