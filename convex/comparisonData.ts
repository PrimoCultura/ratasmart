import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { isCurrentlyValid, requireActiveUser } from "./lib/authHelpers";
import { collectRulesForTable } from "./lib/policyMapper";
import { isTableAvailableOnNetwork } from "../shared/network-config/des-paoleschi-2026";
import { isSimulationSoftDeleted } from "../shared/admin-analytics";

export const getComparisonBundle = internalQuery({
  args: {
    currentUserId: v.id("appUsers"),
    simulationId: v.id("simulations"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx, args.currentUserId);
    const simulation = await ctx.db.get(args.simulationId);

    if (!simulation) {
      throw new Error("Simulazione non trovata.");
    }

    if (
      actor.role !== "admin" &&
      simulation.ownerUserId !== args.currentUserId
    ) {
      throw new Error(
        "Non sei autorizzato a calcolare il confronto per questa simulazione.",
      );
    }

    if (isSimulationSoftDeleted(simulation) && actor.role !== "admin") {
      throw new Error("Simulazione non trovata.");
    }

    const now = Date.now();

    const [
      companies,
      products,
      tables,
      policySets,
      policyRules,
      priorities,
      internalMessages,
    ] = await Promise.all([
      ctx.db.query("financialCompanies").collect(),
      ctx.db.query("financialProducts").collect(),
      ctx.db.query("financialTables").collect(),
      ctx.db.query("policySets").collect(),
      ctx.db.query("policyRules").collect(),
      ctx.db.query("commercialPriorities").collect(),
      ctx.db.query("internalMessages").collect(),
    ]);

    const companyMap = new Map(companies.map((item) => [item._id, item]));
    const productMap = new Map(products.map((item) => [item._id, item]));

    const activeTables = tables.filter((table) => {
      if (!table.isActive) return false;
      if (table.network !== simulation.network) return false;
      if (!isCurrentlyValid(now, table.validFrom, table.validTo)) return false;
      const company = companyMap.get(table.companyId);
      const product = productMap.get(table.productId);
      if (company?.isActive === false || product?.isActive === false) {
        return false;
      }
      if (!company) return false;
      return isTableAvailableOnNetwork({
        network: table.network,
        companyShortName: company.shortName,
        tableCode: table.tableCode,
        customerTanPercent: table.customerTanPercent,
        isActive: table.isActive,
      });
    });

    const rulesByTableId: Record<string, ReturnType<typeof collectRulesForTable>> =
      {};
    for (const table of activeTables) {
      rulesByTableId[table._id] = collectRulesForTable({
        table,
        policySets,
        policyRules,
        now,
        isCurrentlyValid,
      });
    }

    const activePriorities = priorities.filter(
      (item) =>
        item.isActive &&
        item.network === simulation.network &&
        isCurrentlyValid(now, item.validFrom, item.validTo),
    );

    const activeMessages = internalMessages.filter(
      (item) =>
        item.isActive &&
        item.network === simulation.network &&
        isCurrentlyValid(now, item.validFrom, item.validTo),
    );

    return {
      simulation,
      now,
      companies: companies
        .filter((item) => item.isActive)
        .map((item) => ({
          id: item._id as string,
          name: item.name,
          shortName: item.shortName,
          isActive: item.isActive,
        })),
      products: products
        .filter((item) => item.isActive)
        .map((item) => ({
          id: item._id as string,
          companyId: item.companyId as string,
          name: item.name,
          code: item.code,
          category: item.category,
          isActive: item.isActive,
        })),
      tables: activeTables.map((table) => ({
        id: table._id as string,
        companyId: table.companyId as string,
        productId: table.productId as string,
        network: table.network,
        tableCode: table.tableCode,
        displayName: table.displayName,
        description: table.description,
        category: table.category,
        version: table.version,
        minimumAmount: table.minimumAmount,
        maximumAmount: table.maximumAmount,
        minimumDurationMonths: table.minimumDurationMonths,
        maximumDurationMonths: table.maximumDurationMonths,
        durationStepMonths: table.durationStepMonths,
        customerTanPercent: table.customerTanPercent,
        openingFeeType: table.openingFeeType,
        openingFeeValue: table.openingFeeValue,
        collectionFeePerInstallment: table.collectionFeePerInstallment,
        installmentFeeType: table.installmentFeeType,
        installmentFeeValue: table.installmentFeeValue,
        internalCostPercentAt24Months: table.internalCostPercentAt24Months,
        internalCostBase: table.internalCostBase,
        activeCommissionPercent: table.activeCommissionPercent,
        activeCommissionBase: table.activeCommissionBase,
        durationTerms: table.durationTerms,
        firstInstallmentDelayDays: table.firstInstallmentDelayDays,
        requiresManagerAuthorizationNotice:
          table.requiresManagerAuthorizationNotice,
        isActive: table.isActive,
      })),
      rulesByTableId,
      priorities: activePriorities.map((item) => ({
        id: item._id as string,
        network: item.network,
        companyId: item.companyId as string | undefined,
        productId: item.productId as string | undefined,
        financialTableId: item.financialTableId as string | undefined,
        label: item.label,
        visibleReason: item.visibleReason,
        priorityScore: item.priorityScore,
      })),
      internalMessages: activeMessages.map((item) => ({
        id: item._id as string,
        network: item.network,
        companyId: item.companyId as string | undefined,
        productId: item.productId as string | undefined,
        financialTableId: item.financialTableId as string | undefined,
        title: item.title,
        message: item.message,
        messageType: item.messageType,
        iconType: item.iconType,
        requiresPrivacyConfirmation: item.requiresPrivacyConfirmation,
      })),
    };
  },
});

/**
 * @deprecated Fase 3C: `persistComparisonRun` aggiorna già lastComparisonAt.
 * Mantenuta per compatibilità; non usata dall'orchestratore.
 */
export const touchLastComparisonAt = internalMutation({
  args: {
    simulationId: v.id("simulations"),
    comparedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const simulation = await ctx.db.get(args.simulationId);
    if (!simulation) {
      throw new Error("Simulazione non trovata.");
    }
    await ctx.db.patch(args.simulationId, {
      lastComparisonAt: args.comparedAt,
      updatedAt: args.comparedAt,
    });
  },
});
