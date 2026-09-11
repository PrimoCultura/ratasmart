import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isCurrentlyValid, requireAdmin } from "./lib/authHelpers";
import {
  defaultRequiresManagerAuthorization,
  installmentFeeTypeValidator,
  internalCostBaseValidator,
  networkValidator,
  openingFeeTypeValidator,
  productCategoryValidator,
  validateFinancialTableEconomics,
} from "./lib/financialValidation";

const durationTermValidator = v.object({
  durationMonths: v.number(),
  minimumAmount: v.number(),
  maximumAmount: v.number(),
  customerTanPercent: v.optional(v.number()),
  internalCostPercent: v.optional(v.number()),
});

const tableEconomicsArgs = {
  minimumAmount: v.number(),
  maximumAmount: v.number(),
  minimumDurationMonths: v.number(),
  maximumDurationMonths: v.number(),
  durationStepMonths: v.number(),
  customerTanPercent: v.number(),
  openingFeeType: openingFeeTypeValidator,
  openingFeeValue: v.number(),
  collectionFeePerInstallment: v.number(),
  installmentFeeType: v.optional(installmentFeeTypeValidator),
  installmentFeeValue: v.optional(v.number()),
  internalCostPercentAt24Months: v.optional(v.number()),
  internalCostBase: v.optional(internalCostBaseValidator),
  durationTerms: v.optional(v.array(durationTermValidator)),
  firstInstallmentDelayDays: v.array(v.number()),
  requiresManagerAuthorizationNotice: v.boolean(),
};

function legacyCollectionFeeFromInstallment(args: {
  installmentFeeType?: "none" | "fixed" | "percentage_of_requested_amount";
  installmentFeeValue?: number;
  collectionFeePerInstallment: number;
}): number {
  if (args.installmentFeeType === undefined) {
    return args.collectionFeePerInstallment;
  }
  if (args.installmentFeeType === "fixed") {
    return args.installmentFeeValue ?? 0;
  }
  return 0;
}

function normalizeDurationTerms(
  terms:
    | Array<{
        durationMonths: number;
        minimumAmount: number;
        maximumAmount: number;
        customerTanPercent?: number;
        internalCostPercent?: number;
      }>
    | undefined,
) {
  if (!terms || terms.length === 0) {
    return undefined;
  }
  return [...terms]
    .map((term) => {
      const normalized: {
        durationMonths: number;
        minimumAmount: number;
        maximumAmount: number;
        customerTanPercent?: number;
        internalCostPercent?: number;
      } = {
        durationMonths: term.durationMonths,
        minimumAmount: term.minimumAmount,
        maximumAmount: term.maximumAmount,
      };
      if (term.customerTanPercent !== undefined) {
        normalized.customerTanPercent = term.customerTanPercent;
      }
      if (term.internalCostPercent !== undefined) {
        normalized.internalCostPercent = term.internalCostPercent;
      }
      return normalized;
    })
    .sort((a, b) => a.durationMonths - b.durationMonths);
}

export const listFinancialTablesAdmin = query({
  args: {},
  handler: async (ctx) => {
    const tables = await ctx.db.query("financialTables").collect();
    const companies = await ctx.db.query("financialCompanies").collect();
    const products = await ctx.db.query("financialProducts").collect();
    const companyMap = new Map(companies.map((c) => [c._id, c]));
    const productMap = new Map(products.map((p) => [p._id, p]));

    return tables
      .map((table) => ({
        ...table,
        company: companyMap.get(table.companyId) ?? null,
        product: productMap.get(table.productId) ?? null,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const listActiveFinancialTables = query({
  args: {
    network: v.optional(networkValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const tables = args.network
      ? await ctx.db
          .query("financialTables")
          .withIndex("by_network_active", (q) =>
            q.eq("network", args.network!).eq("isActive", true),
          )
          .collect()
      : await ctx.db
          .query("financialTables")
          .withIndex("by_is_active", (q) => q.eq("isActive", true))
          .collect();

    const companies = await ctx.db.query("financialCompanies").collect();
    const products = await ctx.db.query("financialProducts").collect();
    const companyMap = new Map(companies.map((c) => [c._id, c]));
    const productMap = new Map(products.map((p) => [p._id, p]));

    return tables
      .filter(
        (table) =>
          table.isActive &&
          isCurrentlyValid(now, table.validFrom, table.validTo) &&
          companyMap.get(table.companyId)?.isActive !== false &&
          productMap.get(table.productId)?.isActive !== false,
      )
      .map((table) => ({
        ...table,
        company: companyMap.get(table.companyId) ?? null,
        product: productMap.get(table.productId) ?? null,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "it"));
  },
});

export const listTablesByNetwork = query({
  args: { network: networkValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("financialTables")
      .withIndex("by_network", (q) => q.eq("network", args.network))
      .collect();
  },
});

export const listTablesByCompany = query({
  args: { companyId: v.id("financialCompanies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("financialTables")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();
  },
});

export const getFinancialTable = query({
  args: { tableId: v.id("financialTables") },
  handler: async (ctx, args) => {
    const table = await ctx.db.get(args.tableId);
    if (!table) {
      return null;
    }
    const company = await ctx.db.get(table.companyId);
    const product = await ctx.db.get(table.productId);
    return { ...table, company, product };
  },
});

export const createFinancialTable = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    companyId: v.id("financialCompanies"),
    productId: v.id("financialProducts"),
    network: networkValidator,
    tableCode: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    category: productCategoryValidator,
    ...tableEconomicsArgs,
    isActive: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const company = await ctx.db.get(args.companyId);
    const product = await ctx.db.get(args.productId);
    if (!company || !product) {
      throw new Error("Società o prodotto non trovato.");
    }
    if (product.companyId !== args.companyId) {
      throw new Error("Il prodotto non appartiene alla società selezionata.");
    }

    const tableCode = args.tableCode.trim();
    const displayName = args.displayName.trim();
    if (!tableCode || !displayName) {
      throw new Error("Codice tabella e nome visualizzato sono obbligatori.");
    }

    validateFinancialTableEconomics(args);

    const now = Date.now();
    return await ctx.db.insert("financialTables", {
      companyId: args.companyId,
      productId: args.productId,
      network: args.network,
      tableCode,
      displayName,
      description: args.description?.trim() || undefined,
      category: args.category,
      minimumAmount: args.minimumAmount,
      maximumAmount: args.maximumAmount,
      minimumDurationMonths: args.minimumDurationMonths,
      maximumDurationMonths: args.maximumDurationMonths,
      durationStepMonths: args.durationStepMonths,
      customerTanPercent: args.customerTanPercent,
      openingFeeType: args.openingFeeType,
      openingFeeValue: args.openingFeeType === "none" ? 0 : args.openingFeeValue,
      collectionFeePerInstallment: legacyCollectionFeeFromInstallment(args),
      installmentFeeType: args.installmentFeeType,
      installmentFeeValue: args.installmentFeeValue,
      internalCostPercentAt24Months: args.internalCostPercentAt24Months,
      internalCostBase: args.internalCostBase,
      durationTerms: normalizeDurationTerms(args.durationTerms),
      firstInstallmentDelayDays: [...args.firstInstallmentDelayDays].sort(
        (a, b) => a - b,
      ),
      requiresManagerAuthorizationNotice: args.requiresManagerAuthorizationNotice,
      isActive: args.isActive,
      validFrom: args.validFrom,
      validTo: args.validTo,
      adminNotes: args.adminNotes?.trim() || undefined,
      version: 1,
      createdByUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateFinancialTableMetadata = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    tableId: v.id("financialTables"),
    displayName: v.string(),
    description: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const existing = await ctx.db.get(args.tableId);
    if (!existing) {
      throw new Error("Tabella finanziaria non trovata.");
    }

    const displayName = args.displayName.trim();
    if (!displayName) {
      throw new Error("Il nome visualizzato è obbligatorio.");
    }

    await ctx.db.patch(args.tableId, {
      displayName,
      description: args.description?.trim() || undefined,
      adminNotes: args.adminNotes?.trim() || undefined,
      validFrom: args.validFrom,
      validTo: args.validTo,
      updatedAt: Date.now(),
    });

    return args.tableId;
  },
});

export const createNewFinancialTableVersion = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    sourceTableId: v.id("financialTables"),
    companyId: v.id("financialCompanies"),
    productId: v.id("financialProducts"),
    network: networkValidator,
    tableCode: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    category: productCategoryValidator,
    ...tableEconomicsArgs,
    isActive: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const source = await ctx.db.get(args.sourceTableId);
    if (!source) {
      throw new Error("Tabella di origine non trovata.");
    }

    const company = await ctx.db.get(args.companyId);
    const product = await ctx.db.get(args.productId);
    if (!company || !product) {
      throw new Error("Società o prodotto non trovato.");
    }
    if (product.companyId !== args.companyId) {
      throw new Error("Il prodotto non appartiene alla società selezionata.");
    }

    validateFinancialTableEconomics(args);

    const tableCode = args.tableCode.trim();
    const displayName = args.displayName.trim();
    if (!tableCode || !displayName) {
      throw new Error("Codice tabella e nome visualizzato sono obbligatori.");
    }

    const now = Date.now();
    const newId = await ctx.db.insert("financialTables", {
      companyId: args.companyId,
      productId: args.productId,
      network: args.network,
      tableCode,
      displayName,
      description: args.description?.trim() || undefined,
      category: args.category,
      minimumAmount: args.minimumAmount,
      maximumAmount: args.maximumAmount,
      minimumDurationMonths: args.minimumDurationMonths,
      maximumDurationMonths: args.maximumDurationMonths,
      durationStepMonths: args.durationStepMonths,
      customerTanPercent: args.customerTanPercent,
      openingFeeType: args.openingFeeType,
      openingFeeValue: args.openingFeeType === "none" ? 0 : args.openingFeeValue,
      collectionFeePerInstallment: legacyCollectionFeeFromInstallment(args),
      installmentFeeType: args.installmentFeeType,
      installmentFeeValue: args.installmentFeeValue,
      internalCostPercentAt24Months: args.internalCostPercentAt24Months,
      internalCostBase: args.internalCostBase,
      durationTerms: normalizeDurationTerms(args.durationTerms),
      firstInstallmentDelayDays: [...args.firstInstallmentDelayDays].sort(
        (a, b) => a - b,
      ),
      requiresManagerAuthorizationNotice: args.requiresManagerAuthorizationNotice,
      isActive: args.isActive,
      validFrom: args.validFrom,
      validTo: args.validTo,
      adminNotes: args.adminNotes?.trim() || undefined,
      version: source.version + 1,
      supersedesTableId: source._id,
      createdByUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(source._id, {
      isActive: false,
      updatedAt: now,
    });

    return newId;
  },
});

export const setFinancialTableActive = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    tableId: v.id("financialTables"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const existing = await ctx.db.get(args.tableId);
    if (!existing) {
      throw new Error("Tabella finanziaria non trovata.");
    }

    await ctx.db.patch(args.tableId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    return args.tableId;
  },
});

export const defaultAuthorizationForCategory = query({
  args: { category: productCategoryValidator },
  handler: async (_ctx, args) => {
    return defaultRequiresManagerAuthorization(args.category);
  },
});
