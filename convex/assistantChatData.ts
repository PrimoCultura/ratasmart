import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { requireActiveUser } from "./lib/authHelpers";
import { isCurrentlyValid } from "./lib/authHelpers";
import {
  buildAnonymizedSimulationContext,
  buildEntityCatalogFromActiveData,
  buildPreScreeningContext,
  detectPreScreeningIntents,
  formatHistoryForPrompt,
  formatPreScreeningContext,
  mapSolutionSnapshotToSummary,
  matchEntitiesFromQuestion,
  selectHistoryForPrompt,
  shouldAttachPreScreening,
} from "../shared/assistant-context/index";
import {
  formatKnowledgeContext,
  selectRelevantKnowledgeCards,
  type RuntimeKnowledgeCard,
} from "../shared/knowledge-engine/index";
import { isTableAvailableOnNetwork } from "../shared/network-config/des-paoleschi-2026";

/**
 * Bundle server-side per costruire il prompt Virtual Marco.
 * Con o senza simulazione: include pre-screening da tabelle/policy attive.
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
    const tablesRaw = await ctx.db
      .query("financialTables")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
    const companyById = new Map(companies.map((item) => [item._id, item]));
    const tables = tablesRaw.filter((table) => {
      const company = companyById.get(table.companyId);
      if (!company) return false;
      return isTableAvailableOnNetwork({
        network: table.network,
        companyShortName: company.shortName,
        tableCode: table.tableCode,
        customerTanPercent: table.customerTanPercent,
        isActive: table.isActive,
      });
    });

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
    const intents = detectPreScreeningIntents(args.userQuestion);

    let simulationContextText = "";
    let network: "PCG" | "DES" | "Paoleschi" = matched.networks[0] ?? "PCG";
    let companyId = matched.companyIds[0];
    let productId = matched.productIds[0];
    let financialTableId = matched.tableIds[0];
    let resolvedComparisonRunId = conversation.comparisonRunId;
    let hasSimulationContext = false;

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
        hasSimulationContext = simulationContextText.length > 0;

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

    const now = Date.now();
    const policySets = await ctx.db
      .query("policySets")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
    const policyRules = await ctx.db.query("policyRules").collect();

    const attachPreScreening = shouldAttachPreScreening({
      hasSimulationContext,
      intents,
      matched,
      userQuestion: args.userQuestion,
    });

    let preScreeningText = "";
    let preScreeningWarnings: string[] = [];
    let usedPreScreeningContext = false;

    if (attachPreScreening) {
      const preScreening = buildPreScreeningContext({
        intents,
        matched,
        question: args.userQuestion,
        maxCharacters: hasSimulationContext ? 8_000 : 14_000,
        source: {
          network,
          calculationDate: now,
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
            category: item.category,
            isActive: item.isActive,
          })),
          tables: tables.map((item) => ({
            id: item._id,
            companyId: item.companyId,
            productId: item.productId,
            tableCode: item.tableCode,
            displayName: item.displayName,
            category: item.category,
            network: item.network,
            minimumAmount: item.minimumAmount,
            maximumAmount: item.maximumAmount,
            minimumDurationMonths: item.minimumDurationMonths,
            maximumDurationMonths: item.maximumDurationMonths,
            durationStepMonths: item.durationStepMonths,
            durationTerms: item.durationTerms,
            firstInstallmentDelayDays: item.firstInstallmentDelayDays,
            customerTanPercent: item.customerTanPercent,
            isActive: item.isActive,
          })),
          policySets: policySets.map((set) => ({
            id: set._id,
            name: set.name,
            network: set.network,
            companyId: set.companyId,
            productId: set.productId,
            financialTableId: set.financialTableId,
            isActive: set.isActive,
            validFrom: set.validFrom,
            validTo: set.validTo,
          })),
          policyRules: policyRules.map((rule) => ({
            policySetId: rule.policySetId,
            ruleType: rule.ruleType,
            operator: rule.operator,
            numericValue: rule.numericValue,
            stringValue: rule.stringValue,
            booleanValue: rule.booleanValue,
            stringValues: rule.stringValues,
            monthsBuffer: rule.monthsBuffer,
            failureMessage: rule.failureMessage,
            verificationMessage: rule.verificationMessage,
            isActive: rule.isActive,
            sortOrder: rule.sortOrder,
          })),
        },
      });
      preScreeningText = formatPreScreeningContext(preScreening, {
        question: args.userQuestion,
      });
      preScreeningWarnings = preScreening.warnings;
      usedPreScreeningContext = preScreeningText.length > 0;
    }

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
        supersedesCardId: card.supersedesCardId,
      }));

    // Preferisci tutte le finanziarie citate nella domanda (query multi-company).
    const knowledgeCompanyIds =
      matched.companyIds.length > 0
        ? matched.companyIds
        : companyId
          ? [companyId]
          : undefined;
    const knowledgeProductIds =
      matched.productIds.length > 0
        ? matched.productIds
        : productId
          ? [productId]
          : undefined;
    const knowledgeTableIds =
      matched.tableIds.length > 0
        ? matched.tableIds
        : financialTableId
          ? [financialTableId]
          : undefined;

    const knowledgeSelection = selectRelevantKnowledgeCards(
      runtimeCards,
      {
        network,
        companyId: knowledgeCompanyIds?.[0],
        companyIds: knowledgeCompanyIds,
        productId: knowledgeProductIds?.[0],
        productIds: knowledgeProductIds,
        financialTableId: knowledgeTableIds?.[0],
        financialTableIds: knowledgeTableIds,
        userQuestion: args.userQuestion,
        calculationDate: now,
        privacyMode: conversation.privacyMode,
      },
      { maxCards: 12, maxCharacters: 18_000 },
    );

    const structuredParts = [
      simulationContextText,
      preScreeningText,
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
        ...preScreeningWarnings,
        ...knowledgeSelection.warnings,
      ],
      resolvedComparisonRunId,
      matched,
      intents,
      usedPreScreeningContext,
      matchedCompanyIds: matched.companyIds,
    };
  },
});
