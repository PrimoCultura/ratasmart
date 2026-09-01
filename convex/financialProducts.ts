import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/authHelpers";
import { productCategoryValidator } from "./lib/financialValidation";

export const listFinancialProducts = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("financialProducts").collect();
    return products.sort((a, b) => a.name.localeCompare(b.name, "it"));
  },
});

export const listProductsByCompany = query({
  args: { companyId: v.id("financialCompanies") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("financialProducts")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();
    return products.sort((a, b) => a.name.localeCompare(b.name, "it"));
  },
});

export const listActiveProductsByCompany = query({
  args: { companyId: v.id("financialCompanies") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("financialProducts")
      .withIndex("by_company_active", (q) =>
        q.eq("companyId", args.companyId).eq("isActive", true),
      )
      .collect();
    return products.sort((a, b) => a.name.localeCompare(b.name, "it"));
  },
});

export const getFinancialProduct = query({
  args: { productId: v.id("financialProducts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.productId);
  },
});

export const listFinancialProductsWithStats = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("financialProducts").collect();
    const companies = await ctx.db.query("financialCompanies").collect();
    const tables = await ctx.db.query("financialTables").collect();
    const companyMap = new Map(companies.map((c) => [c._id, c]));

    return products
      .map((product) => ({
        ...product,
        company: companyMap.get(product.companyId) ?? null,
        tableCount: tables.filter((t) => t.productId === product._id).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "it"));
  },
});

export const createFinancialProduct = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    companyId: v.id("financialCompanies"),
    name: v.string(),
    code: v.optional(v.string()),
    category: productCategoryValidator,
    description: v.optional(v.string()),
    isActive: v.boolean(),
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
      throw new Error("Il nome del prodotto è obbligatorio.");
    }

    const now = Date.now();
    return await ctx.db.insert("financialProducts", {
      companyId: args.companyId,
      name,
      code: args.code?.trim() || undefined,
      category: args.category,
      description: args.description?.trim() || undefined,
      isActive: args.isActive,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateFinancialProduct = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    productId: v.id("financialProducts"),
    name: v.string(),
    code: v.optional(v.string()),
    category: productCategoryValidator,
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const existing = await ctx.db.get(args.productId);
    if (!existing) {
      throw new Error("Prodotto non trovato.");
    }

    const name = args.name.trim();
    if (!name) {
      throw new Error("Il nome del prodotto è obbligatorio.");
    }

    await ctx.db.patch(args.productId, {
      name,
      code: args.code?.trim() || undefined,
      category: args.category,
      description: args.description?.trim() || undefined,
      updatedAt: Date.now(),
    });

    return args.productId;
  },
});

export const setFinancialProductActive = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    productId: v.id("financialProducts"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const existing = await ctx.db.get(args.productId);
    if (!existing) {
      throw new Error("Prodotto non trovato.");
    }

    await ctx.db.patch(args.productId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    return args.productId;
  },
});
