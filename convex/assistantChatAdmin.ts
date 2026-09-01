import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { requireAdmin } from "./lib/authHelpers";

export const getActiveConfigForTest = internalQuery({
  args: {
    actorUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const active = await ctx.db
      .query("assistantConfigs")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
    const config = active[0];
    if (!config) {
      throw new Error("Nessuna configurazione attiva.");
    }
    return {
      _id: config._id,
      modelProvider: config.modelProvider,
      modelName: config.modelName,
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      version: config.version,
      behaviorPrompt: config.behaviorPrompt,
    };
  },
});
