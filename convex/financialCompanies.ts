import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/authHelpers";

export const listFinancialCompanies = query({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db.query("financialCompanies").collect();
    return companies.sort((a, b) => a.name.localeCompare(b.name, "it"));
  },
});

export const listActiveFinancialCompanies = query({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db
      .query("financialCompanies")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
    return companies.sort((a, b) => a.name.localeCompare(b.name, "it"));
  },
});

export const getFinancialCompany = query({
  args: { companyId: v.id("financialCompanies") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.companyId);
  },
});

export const getFinancialCompanyStats = query({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db.query("financialCompanies").collect();
    const products = await ctx.db.query("financialProducts").collect();
    const tables = await ctx.db.query("financialTables").collect();

    return companies.map((company) => ({
      ...company,
      productCount: products.filter((p) => p.companyId === company._id).length,
      tableCount: tables.filter((t) => t.companyId === company._id).length,
    }));
  },
});

export const createFinancialCompany = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    name: v.string(),
    shortName: v.string(),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const name = args.name.trim();
    const shortName = args.shortName.trim();
    if (!name || !shortName) {
      throw new Error("Nome e nome breve sono obbligatori.");
    }

    const now = Date.now();
    return await ctx.db.insert("financialCompanies", {
      name,
      shortName,
      description: args.description?.trim() || undefined,
      logoUrl: args.logoUrl?.trim() || undefined,
      isActive: args.isActive,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateFinancialCompany = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    companyId: v.id("financialCompanies"),
    name: v.string(),
    shortName: v.string(),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const existing = await ctx.db.get(args.companyId);
    if (!existing) {
      throw new Error("Società finanziaria non trovata.");
    }

    const name = args.name.trim();
    const shortName = args.shortName.trim();
    if (!name || !shortName) {
      throw new Error("Nome e nome breve sono obbligatori.");
    }

    await ctx.db.patch(args.companyId, {
      name,
      shortName,
      description: args.description?.trim() || undefined,
      logoUrl: args.logoUrl?.trim() || undefined,
      updatedAt: Date.now(),
    });

    return args.companyId;
  },
});

export const setFinancialCompanyActive = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    companyId: v.id("financialCompanies"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const existing = await ctx.db.get(args.companyId);
    if (!existing) {
      throw new Error("Società finanziaria non trovata.");
    }

    await ctx.db.patch(args.companyId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    return args.companyId;
  },
});
