import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { requireActiveUser } from "./lib/authHelpers";
import { isCurrentlyValid } from "./lib/authHelpers";
import {
  buildAnonymizedSimulationContext,
  buildEntityCatalogFromActiveData,
  buildPolicyAndTableContext,
  formatHistoryForPrompt,
  mapSolutionSnapshotToSummary,
  matchEntitiesFromQuestion,
  selectHistoryForPrompt,
} from "../shared/assistant-context/index";
import {
  formatKnowledgeContext,
  selectRelevantKnowledgeCards,
  type RuntimeKnowledgeCard,
} from "../shared/knowledge-engine/index";

/**
 * Bundle server-side per costruire il prompt Virtual Marco.
 * Nessun identificativo paziente nel testo prodotto.
 */
export const getVirtualMarcoTurnBundle = internalQuery({
  args: {
    currentUserId: v.id("appUsers"),
    conversationId: v.id("assistantConversations"),
    userQuestion: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx, args.currentUserId);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversazione non trovata.");
    }
    if (conversation.ownerUserId !== args.currentUserId) {
      throw new Error("Non sei autorizzato su questa conversazione.");
    }
    if (actor.role === "admin") {
      // Admin non invia messaggi operativi via questa action CM.
      throw new Error("Solo il Clinic Manager proprietario può inviare messaggi.");
    }

    const activeConfigs = await ctx.db
      .query("assistantConfigs")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
    const config = activeConfigs[0] ?? null;
    if (!config) {
      throw new Error("Nessuna configurazione attiva di Virtual Marco.");
    }

    const historyDocs = await ctx.db
      .query("assistantMessages")
      .withIndex("by_conversation_created_at", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc")
      .collect();

    const historySelection = selectHistoryForPrompt(
      historyDocs
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          role: message.role,
          content: message.content,
          status: message.status,
        })),
    );

    const companies = await ctx.db
      .query("financialCompanies")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
    const products = await ctx.db
      .query("financialProducts")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
    const tables = await ctx.db
      .query("financialTables")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    const catalog = buildEntityCatalogFromActiveData({
      companies: companies.map((item) => ({
        id: item._id,
        name: item.name,
        shortName: item.shortName,
      })),
      products: products.map((item) => ({
        id: item._id,
        companyId: item.companyId,
        name: item.name,
        code: item.code,
      })),
      tables: tables.map((item) => ({
        id: item._id,
        companyId: item.companyId,
        productId: item.productId,
        tableCode: item.tableCode,
        displayName: item.displayName,
        network: item.network,
      })),
    });

    const matched = matchEntitiesFromQuestion(args.userQuestion, catalog);

    let simulationContextText = "";
    let network: "PCG" | "DES" = matched.networks[0] ?? "PCG";
    let companyId = matched.companyIds[0];
    let productId = matched.productIds[0];
    let financialTableId = matched.tableIds[0];
    let resolvedComparisonRunId = conversation.comparisonRunId;

    if (conversation.simulationId) {
      const simulation = await ctx.db.get(conversation.simulationId);
      if (!simulation) {
        throw new Error("Simulazione collegata non trovata.");
      }
      if (simulation.ownerUserId !== args.currentUserId) {
        throw new Error("Simulazione non autorizzata.");
      }
      network = simulation.network;

      let run = conversation.comparisonRunId
        ? await ctx.db.get(conversation.comparisonRunId)
        : null;
      if (!run && simulation.latestComparisonRunId) {
        run = await ctx.db.get(simulation.latestComparisonRunId);
      }
      if (run) {
        resolvedComparisonRunId = run._id;
        const solutions = await ctx.db
          .query("simulationComparisonSolutions")
          .withIndex("by_run", (q) => q.eq("comparisonRunId", run._id))
          .collect();

        const summaries = solutions.map((solution) =>
          mapSolutionSnapshotToSummary(solution),
        );
        const proposed = simulation.proposedSolutionId
          ? solutions.find((item) => item._id === simulation.proposedSolutionId)
          : solutions.find((item) => item.isProposed);

        simulationContextText = buildAnonymizedSimulationContext({
          network: run.network,
          requestedAmount: run.requestedAmount,
          targetInstallment: run.targetInstallment,
          selectedDurationMonths: run.selectedDurationMonths,
          selectedFirstInstallmentDelayDays: run.selectedFirstInstallmentDelayDays,
          patient: {
            age: run.patientSnapshot.age,
            employmentType: run.patientSnapshot.employmentType,
            temporaryContractExpiry: run.patientSnapshot.temporaryContractExpiry,
            isNonEuCitizen: run.patientSnapshot.isNonEuCitizen,
            residencePermitExpiry: run.patientSnapshot.residencePermitExpiry,
          },
          solutions: summaries,
          proposedSolution: proposed
            ? mapSolutionSnapshotToSummary(proposed)
            : null,
          privacyMode: conversation.privacyMode,
        });

        // Scope knowledge dalle soluzioni del run
        const firstCompatible =
          solutions.find((item) => item.resultGroup === "compatible") ??
          solutions[0];
        if (firstCompatible) {
          companyId = firstCompatible.companySnapshot.companyId;
          productId = firstCompatible.productSnapshot.productId;
          financialTableId =
            firstCompatible.financialTableSnapshot.financialTableId;
        }
      }
    }

    const policySets = await ctx.db
      .query("policySets")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
    const policyRules = await ctx.db.query("policyRules").collect();
    const rulesBySet = new Map<string, typeof policyRules>();
    for (const rule of policyRules) {
      const list = rulesBySet.get(rule.policySetId) ?? [];
      list.push(rule);
      rulesBySet.set(rule.policySetId, list);
    }

    const policyContext = conversation.simulationId
      ? { text: "", warnings: [] as string[] }
      : buildPolicyAndTableContext({
          matched,
          policies: policySets.map((set) => ({
            id: set._id,
            name: set.name,
            network: set.network,
            companyId: set.companyId,
            productId: set.productId,
            financialTableId: set.financialTableId,
            rules: (rulesBySet.get(set._id) ?? []).map((rule) => ({
              ruleType: rule.ruleType,
              message: rule.failureMessage,
              summary: rule.failureMessage,
            })),
          })),
          tables: tables.map((table) => ({
            id: table._id,
            tableCode: table.tableCode,
            displayName: table.displayName,
            network: table.network,
            companyId: table.companyId,
            productId: table.productId,
            customerTanPercent: table.customerTanPercent,
            minimumAmount: table.minimumAmount,
            maximumAmount: table.maximumAmount,
            minimumDurationMonths: table.minimumDurationMonths,
            maximumDurationMonths: table.maximumDurationMonths,
          })),
        });

    const now = Date.now();
    const cards = await ctx.db
      .query("knowledgeCards")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    const runtimeCards: RuntimeKnowledgeCard[] = cards
      .filter((card) => isCurrentlyValid(now, card.validFrom, card.validTo))
      .map((card) => ({
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
      }));

    const knowledgeSelection = selectRelevantKnowledgeCards(
      runtimeCards,
      {
        network,
        companyId,
        productId,
        financialTableId,
        userQuestion: args.userQuestion,
        calculationDate: now,
        privacyMode: conversation.privacyMode,
      },
      { maxCards: 12, maxCharacters: 18_000 },
    );

    const structuredParts = [
      simulationContextText,
      policyContext.text,
    ].filter(Boolean);

    return {
      conversation,
      config: {
        _id: config._id,
        behaviorPrompt: config.behaviorPrompt,
        modelProvider: config.modelProvider,
        modelName: config.modelName,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        version: config.version,
      },
      historyText: formatHistoryForPrompt(historySelection.messages),
      historyWarnings: historySelection.warnings,
      structuredContext: structuredParts.join("\n\n"),
      knowledgeContext: formatKnowledgeContext(knowledgeSelection.selectedCards),
      knowledgeSelection,
      knowledgeSources: knowledgeSelection.selectedCards.map((card) => {
        const original = cards.find((item) => item._id === card.id);
        return {
          knowledgeCardId: card.id as typeof cards[number]["_id"],
          knowledgeCardVersion: original?.version ?? card.version ?? 1,
          titleSnapshot: card.title,
          categorySnapshot: card.category,
          score: card.score,
          matchReasons: card.matchReasons,
        };
      }),
      contextWarnings: [
        ...historySelection.warnings,
        ...policyContext.warnings,
        ...knowledgeSelection.warnings,
      ],
      resolvedComparisonRunId,
      matched,
    };
  },
});
