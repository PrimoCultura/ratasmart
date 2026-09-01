import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/authHelpers";
import {
  networkValidator,
  policyOperatorValidator,
  policyRuleTypeValidator,
} from "./lib/financialValidation";

export const listPolicySets = query({
  args: {},
  handler: async (ctx) => {
    const sets = await ctx.db.query("policySets").collect();
    const rules = await ctx.db.query("policyRules").collect();
    const companies = await ctx.db.query("financialCompanies").collect();
    const products = await ctx.db.query("financialProducts").collect();
    const tables = await ctx.db.query("financialTables").collect();

    const companyMap = new Map(companies.map((c) => [c._id, c]));
    const productMap = new Map(products.map((p) => [p._id, p]));
    const tableMap = new Map(tables.map((t) => [t._id, t]));

    return sets
      .map((set) => ({
        ...set,
        company: companyMap.get(set.companyId) ?? null,
        product: set.productId ? productMap.get(set.productId) ?? null : null,
        financialTable: set.financialTableId
          ? tableMap.get(set.financialTableId) ?? null
          : null,
        ruleCount: rules.filter((r) => r.policySetId === set._id).length,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const getPolicySetWithRules = query({
  args: { policySetId: v.id("policySets") },
  handler: async (ctx, args) => {
    const set = await ctx.db.get(args.policySetId);
    if (!set) {
      return null;
    }

    const rules = await ctx.db
      .query("policyRules")
      .withIndex("by_policy_set_order", (q) => q.eq("policySetId", args.policySetId))
      .collect();

    const company = await ctx.db.get(set.companyId);
    const product = set.productId ? await ctx.db.get(set.productId) : null;
    const financialTable = set.financialTableId
      ? await ctx.db.get(set.financialTableId)
      : null;

    return {
      ...set,
      company,
      product,
      financialTable,
      rules: rules.sort((a, b) => a.sortOrder - b.sortOrder),
    };
  },
});

export const createPolicySet = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    companyId: v.id("financialCompanies"),
    productId: v.optional(v.id("financialProducts")),
    financialTableId: v.optional(v.id("financialTables")),
    network: networkValidator,
    name: v.string(),
    description: v.optional(v.string()),
    sourceReference: v.optional(v.string()),
    isActive: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const company = await ctx.db.get(args.companyId);
    if (!company) {
      throw new Error("Società finanziaria non trovata.");
    }

    const name = args.name.trim();
    if (!name) {
      throw new Error("Il nome della policy è obbligatorio.");
    }

    const now = Date.now();
    return await ctx.db.insert("policySets", {
      companyId: args.companyId,
      productId: args.productId,
      financialTableId: args.financialTableId,
      network: args.network,
      name,
      description: args.description?.trim() || undefined,
      sourceReference: args.sourceReference?.trim() || undefined,
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

export const createNewPolicySetVersion = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    sourcePolicySetId: v.id("policySets"),
    companyId: v.id("financialCompanies"),
    productId: v.optional(v.id("financialProducts")),
    financialTableId: v.optional(v.id("financialTables")),
    network: networkValidator,
    name: v.string(),
    description: v.optional(v.string()),
    sourceReference: v.optional(v.string()),
    isActive: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
    copyRules: v.boolean(),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const source = await ctx.db.get(args.sourcePolicySetId);
    if (!source) {
      throw new Error("Policy di origine non trovata.");
    }

    const name = args.name.trim();
    if (!name) {
      throw new Error("Il nome della policy è obbligatorio.");
    }

    const now = Date.now();
    const newId = await ctx.db.insert("policySets", {
      companyId: args.companyId,
      productId: args.productId,
      financialTableId: args.financialTableId,
      network: args.network,
      name,
      description: args.description?.trim() || undefined,
      sourceReference: args.sourceReference?.trim() || undefined,
      isActive: args.isActive,
      validFrom: args.validFrom,
      validTo: args.validTo,
      version: source.version + 1,
      supersedesPolicySetId: source._id,
      createdByUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    });

    if (args.copyRules) {
      const rules = await ctx.db
        .query("policyRules")
        .withIndex("by_policy_set", (q) => q.eq("policySetId", source._id))
        .collect();

      for (const rule of rules) {
        await ctx.db.insert("policyRules", {
          policySetId: newId,
          ruleType: rule.ruleType,
          operator: rule.operator,
          numericValue: rule.numericValue,
          stringValue: rule.stringValue,
          booleanValue: rule.booleanValue,
          stringValues: rule.stringValues,
          monthsBuffer: rule.monthsBuffer,
          failureMessage: rule.failureMessage,
          verificationMessage: rule.verificationMessage,
          adminNotes: rule.adminNotes,
          sortOrder: rule.sortOrder,
          isActive: rule.isActive,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(source._id, {
      isActive: false,
      updatedAt: now,
    });

    return newId;
  },
});

export const setPolicySetActive = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    policySetId: v.id("policySets"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const existing = await ctx.db.get(args.policySetId);
    if (!existing) {
      throw new Error("Policy non trovata.");
    }

    await ctx.db.patch(args.policySetId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    return args.policySetId;
  },
});

export const addPolicyRule = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    policySetId: v.id("policySets"),
    ruleType: policyRuleTypeValidator,
    operator: policyOperatorValidator,
    numericValue: v.optional(v.number()),
    stringValue: v.optional(v.string()),
    booleanValue: v.optional(v.boolean()),
    stringValues: v.optional(v.array(v.string())),
    monthsBuffer: v.optional(v.number()),
    failureMessage: v.string(),
    verificationMessage: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const set = await ctx.db.get(args.policySetId);
    if (!set) {
      throw new Error("Policy non trovata.");
    }

    const failureMessage = args.failureMessage.trim();
    if (!failureMessage) {
      throw new Error("Il messaggio di non compatibilità è obbligatorio.");
    }

    const existingRules = await ctx.db
      .query("policyRules")
      .withIndex("by_policy_set", (q) => q.eq("policySetId", args.policySetId))
      .collect();

    const sortOrder =
      args.sortOrder ??
      (existingRules.length === 0
        ? 1
        : Math.max(...existingRules.map((r) => r.sortOrder)) + 1);

    const now = Date.now();
    const ruleId = await ctx.db.insert("policyRules", {
      policySetId: args.policySetId,
      ruleType: args.ruleType,
      operator: args.operator,
      numericValue: args.numericValue,
      stringValue: args.stringValue?.trim() || undefined,
      booleanValue: args.booleanValue,
      stringValues: args.stringValues,
      monthsBuffer: args.monthsBuffer,
      failureMessage,
      verificationMessage: args.verificationMessage?.trim() || undefined,
      adminNotes: args.adminNotes?.trim() || undefined,
      sortOrder,
      isActive: args.isActive,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.policySetId, { updatedAt: now });
    return ruleId;
  },
});

export const updatePolicyRule = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    ruleId: v.id("policyRules"),
    ruleType: policyRuleTypeValidator,
    operator: policyOperatorValidator,
    numericValue: v.optional(v.number()),
    stringValue: v.optional(v.string()),
    booleanValue: v.optional(v.boolean()),
    stringValues: v.optional(v.array(v.string())),
    monthsBuffer: v.optional(v.number()),
    failureMessage: v.string(),
    verificationMessage: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
    sortOrder: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error("Regola non trovata.");
    }

    const failureMessage = args.failureMessage.trim();
    if (!failureMessage) {
      throw new Error("Il messaggio di non compatibilità è obbligatorio.");
    }

    const now = Date.now();
    await ctx.db.patch(args.ruleId, {
      ruleType: args.ruleType,
      operator: args.operator,
      numericValue: args.numericValue,
      stringValue: args.stringValue?.trim() || undefined,
      booleanValue: args.booleanValue,
      stringValues: args.stringValues,
      monthsBuffer: args.monthsBuffer,
      failureMessage,
      verificationMessage: args.verificationMessage?.trim() || undefined,
      adminNotes: args.adminNotes?.trim() || undefined,
      sortOrder: args.sortOrder,
      isActive: args.isActive,
      updatedAt: now,
    });

    await ctx.db.patch(rule.policySetId, { updatedAt: now });
    return args.ruleId;
  },
});

export const deletePolicyRule = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    ruleId: v.id("policyRules"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error("Regola non trovata.");
    }

    await ctx.db.delete(args.ruleId);
    await ctx.db.patch(rule.policySetId, { updatedAt: Date.now() });
    return true;
  },
});

export const reorderPolicyRules = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    policySetId: v.id("policySets"),
    orderedRuleIds: v.array(v.id("policyRules")),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const now = Date.now();
    for (let index = 0; index < args.orderedRuleIds.length; index += 1) {
      const ruleId = args.orderedRuleIds[index];
      if (!ruleId) continue;
      const rule = await ctx.db.get(ruleId);
      if (!rule || rule.policySetId !== args.policySetId) {
        throw new Error("Regola non valida per questa policy.");
      }
      await ctx.db.patch(ruleId, {
        sortOrder: index + 1,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.policySetId, { updatedAt: now });
    return true;
  },
});
