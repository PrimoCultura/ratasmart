"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { buildComparisonResult } from "../shared/policy-engine/index";
import {
  resolveEmploymentSeniorityMonths,
} from "../shared/policy-engine/employment-seniority";
import { resolvePatientAge } from "../shared/policy-engine/patient-age";
import type {
  PatientFinancialProfile,
  SimulationComparisonResult,
} from "../shared/policy-engine/types";
import { FINANCIAL_ENGINE_VERSION } from "../shared/financial-engine/index";
import {
  ALTERNATIVE_DIAGNOSTICS_VERSION,
  buildComparisonDiagnostics,
} from "../shared/alternative-diagnostics/index";
import {
  analyzeZeroInterestAlternative,
  ZERO_INTEREST_ALTERNATIVE_VERSION,
  type ZeroInterestAlternativeAnalysis,
} from "../shared/zero-interest-alternative/index";
import type { RuntimeFinancialTable } from "../shared/policy-engine/comparison";
import {
  regenerateAmortizationFromInputSnapshot,
  stripUndefinedDeep,
} from "./lib/comparisonSnapshotMapper";
import type { Id } from "./_generated/dataModel";

type InternalMessagePayload = {
  id: string;
  title: string;
  message: string;
  messageType: "positive" | "warning" | "information";
  iconType: "plus" | "exclamation" | "info";
  requiresPrivacyConfirmation: boolean;
};

export type CalculateSimulationComparisonResult = SimulationComparisonResult & {
  internalMessagesById: Record<string, InternalMessagePayload>;
  comparisonRunId: string;
  runNumber: number;
  persistentSolutionIds: Record<string, string>;
  source: "initial_calculation" | "manual_recalculation";
  isHistorical: false;
  wasDuplicateRequest: boolean;
  diagnostics?: ReturnType<typeof buildComparisonDiagnostics>;
  zeroInterestAlternative?: ZeroInterestAlternativeAnalysis;
};

/**
 * Orchestratore confronto simulazione (Fase 3C).
 * Calcola, persiste snapshot immutabile, restituisce run + mapping ID.
 */
export const calculateSimulationComparison = action({
  args: {
    currentUserId: v.id("appUsers"),
    simulationId: v.id("simulations"),
    requestId: v.string(),
    source: v.union(
      v.literal("initial_calculation"),
      v.literal("manual_recalculation"),
    ),
    selectedDurationMonths: v.optional(v.number()),
    selectedFirstInstallmentDelayDays: v.optional(
      v.union(v.literal(30), v.literal(60), v.literal(90)),
    ),
  },
  handler: async (ctx, args): Promise<CalculateSimulationComparisonResult> => {
    try {
      const bundle = await ctx.runQuery(
        internal.comparisonData.getComparisonBundle,
        {
          currentUserId: args.currentUserId,
          simulationId: args.simulationId,
        },
      );

      const simulation = bundle.simulation;

      if (
        simulation.employmentType === undefined ||
        simulation.isNonEuCitizen === undefined ||
        simulation.requestedAmount === undefined
      ) {
        throw new Error(
          "Simulazione incompleta: completare i dati paziente obbligatori.",
        );
      }

      if (!simulation.patientBirthDate?.trim()) {
        throw new Error(
          "Completare la data di nascita prima di calcolare o ricalcolare. Le simulazioni legacy richiedono la data di nascita per un nuovo confronto.",
        );
      }

      if (bundle.tables.length === 0) {
        throw new Error(
          `Nessuna tabella attiva disponibile per la rete ${simulation.network}.`,
        );
      }

      const calculationDate = bundle.now;

      const resolvedAge = resolvePatientAge({
        birthDate: simulation.patientBirthDate,
        legacyAge: simulation.patientAge,
        referenceDate: calculationDate,
      });
      if (!resolvedAge) {
        throw new Error(
          "Impossibile determinare l'età dalla data di nascita alla data di riferimento.",
        );
      }

      const employmentSeniorityMonths = resolveEmploymentSeniorityMonths({
        employmentStartDate: simulation.employmentStartDate,
        employmentSeniorityMonths: simulation.employmentSeniorityMonths,
        referenceDate: calculationDate,
      });

      const patient: PatientFinancialProfile = {
        age: resolvedAge.age,
        birthDate: resolvedAge.birthDate ?? simulation.patientBirthDate,
        employmentType: simulation.employmentType,
        temporaryContractExpiry: simulation.temporaryContractExpiry,
        isNonEuCitizen: simulation.isNonEuCitizen,
        residencePermitExpiry: simulation.residencePermitExpiry,
        hasResidencePermitRenewalReceiptOnly:
          simulation.hasResidencePermitRenewalReceiptOnly,
        employmentStartDate: simulation.employmentStartDate,
        employmentSeniorityMonths,
        hasGuarantor: simulation.hasGuarantor,
      };

      const patientRequestsZeroInterest =
        simulation.patientRequestsZeroInterest === true;

      const result = buildComparisonResult({
        simulationId: simulation._id,
        network: simulation.network,
        calculationDate,
        patient,
        requestedAmount: simulation.requestedAmount,
        targetInstallment: simulation.targetInstallment,
        preferredDurationMonths: simulation.requestedDurationMonths,
        preferredFirstInstallmentDelayDays:
          simulation.preferredFirstInstallmentDelayDays,
        selectedDurationMonths: args.selectedDurationMonths,
        selectedFirstInstallmentDelayDays:
          args.selectedFirstInstallmentDelayDays,
        companies: bundle.companies,
        products: bundle.products,
        tables: bundle.tables,
        rulesByTableId: bundle.rulesByTableId,
        priorities: bundle.priorities,
        internalMessages: bundle.internalMessages.map(
          (item: {
            id: string;
            network: "PCG" | "DES" | "Paoleschi";
            companyId?: string;
            productId?: string;
            financialTableId?: string;
          }) => ({
            id: item.id,
            network: item.network,
            companyId: item.companyId,
            productId: item.productId,
            financialTableId: item.financialTableId,
          }),
        ),
      });

      const messagesById: Record<string, InternalMessagePayload> = {};
      for (const item of bundle.internalMessages) {
        messagesById[item.id] = {
          id: item.id,
          title: item.title,
          message: item.message,
          messageType: item.messageType,
          iconType: item.iconType,
          requiresPrivacyConfirmation: item.requiresPrivacyConfirmation,
        };
      }

      const companyNameById: Record<string, string> = {};
      for (const company of bundle.companies) {
        companyNameById[company.id] = company.shortName ?? company.name;
      }

      const diagnostics = buildComparisonDiagnostics({
        calculationDate,
        requestedAmount: simulation.requestedAmount,
        selectedDurationMonths: result.selectedDurationMonths,
        firstInstallmentDelayDays: result.selectedFirstInstallmentDelayDays,
        patient,
        compatibleSolutions: result.compatibleSolutions,
        verificationRequiredSolutions: result.verificationRequiredSolutions,
        incompatibleSolutions: result.incompatibleSolutions,
        tables: bundle.tables,
        companyNameById,
        rulesByTableId: bundle.rulesByTableId,
      });

      const tablesById: Record<string, RuntimeFinancialTable> = {};
      for (const table of bundle.tables as RuntimeFinancialTable[]) {
        tablesById[table.id] = table;
      }

      const zeroInterestAlternative = analyzeZeroInterestAlternative({
        enabled: patientRequestsZeroInterest,
        requestedAmount: simulation.requestedAmount,
        referenceDate: calculationDate,
        compatibleSolutions: result.compatibleSolutions,
        tablesById,
      });

      const persisted = await ctx.runMutation(
        internal.comparisonPersistence.persistComparisonRun,
        {
          simulationId: args.simulationId,
          ownerUserId: simulation.ownerUserId,
          requestId: args.requestId,
          source: args.source,
          calculationDate,
          requestedAmount: simulation.requestedAmount,
          patientSnapshot: stripUndefinedDeep({
            firstName: simulation.patientFirstName,
            lastName: simulation.patientLastName,
            age: resolvedAge.age,
            birthDate: simulation.patientBirthDate,
            ageAtReferenceDate: resolvedAge.ageAtReferenceDate ?? resolvedAge.age,
            employmentType: simulation.employmentType,
            temporaryContractExpiry: simulation.temporaryContractExpiry,
            isNonEuCitizen: simulation.isNonEuCitizen,
            residencePermitExpiry: simulation.residencePermitExpiry,
            hasResidencePermitRenewalReceiptOnly:
              simulation.hasResidencePermitRenewalReceiptOnly,
            employmentStartDate: simulation.employmentStartDate,
            employmentSeniorityMonths,
            seniorityReferenceDate: calculationDate,
            hasGuarantor: simulation.hasGuarantor,
            patientRequestsZeroInterest,
          }),
          result,
          messagesById,
          tables: bundle.tables.map(
            (table: {
              id: string;
              version: number;
              tableCode: string;
              displayName: string;
              description?: string;
              network: "PCG" | "DES" | "Paoleschi";
              category: string;
              minimumAmount: number;
              maximumAmount: number;
              minimumDurationMonths: number;
              maximumDurationMonths: number;
              durationStepMonths: number;
              customerTanPercent: number;
              openingFeeType: "none" | "fixed" | "percentage";
              openingFeeValue: number;
              collectionFeePerInstallment: number;
              internalCostPercentAt24Months?: number;
              firstInstallmentDelayDays: number[];
              requiresManagerAuthorizationNotice: boolean;
            }) =>
              stripUndefinedDeep({
                id: table.id,
                version: table.version,
                tableCode: table.tableCode,
                displayName: table.displayName,
                description: table.description,
                network: table.network,
                category: table.category,
                minimumAmount: table.minimumAmount,
                maximumAmount: table.maximumAmount,
                minimumDurationMonths: table.minimumDurationMonths,
                maximumDurationMonths: table.maximumDurationMonths,
                durationStepMonths: table.durationStepMonths,
                customerTanPercent: table.customerTanPercent,
                openingFeeType: table.openingFeeType,
                openingFeeValue: table.openingFeeValue,
                collectionFeePerInstallment: table.collectionFeePerInstallment,
                internalCostPercentAt24Months:
                  table.internalCostPercentAt24Months,
                firstInstallmentDelayDays: table.firstInstallmentDelayDays,
                requiresManagerAuthorizationNotice:
                  table.requiresManagerAuthorizationNotice,
              }),
          ),
          products: bundle.products.map(
            (product: {
              id: string;
              name: string;
              code?: string;
              category?: string;
            }) =>
              stripUndefinedDeep({
                id: product.id,
                name: product.name,
                code: product.code,
                category: product.category,
              }),
          ),
          diagnosticsSnapshot: diagnostics,
          alternativeDiagnosticsVersion: ALTERNATIVE_DIAGNOSTICS_VERSION,
          zeroInterestAlternativeSnapshot: patientRequestsZeroInterest
            ? zeroInterestAlternative
            : undefined,
          zeroInterestAlternativeVersion: patientRequestsZeroInterest
            ? ZERO_INTEREST_ALTERNATIVE_VERSION
            : undefined,
        },
      );

      const persistentSolutionIds: Record<string, string> = {};
      for (const [runtimeId, persistentId] of Object.entries(
        persisted.runtimeToPersistentIds,
      )) {
        persistentSolutionIds[runtimeId] = persistentId as string;
      }

      return {
        ...result,
        internalMessagesById: messagesById,
        comparisonRunId: persisted.comparisonRunId,
        runNumber: persisted.runNumber,
        persistentSolutionIds,
        source: args.source,
        isHistorical: false,
        wasDuplicateRequest: persisted.wasDuplicate,
        diagnostics,
        zeroInterestAlternative: patientRequestsZeroInterest
          ? zeroInterestAlternative
          : undefined,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore nel confronto.";
      console.error("[calculateSimulationComparison]", {
        simulationId: args.simulationId,
        error: message,
      });
      throw new Error(message);
    }
  },
});

/**
 * Rigenera il piano di ammortamento dagli input fotografati (Fase 3C).
 */
export const regenerateAmortizationScheduleFromSnapshot = action({
  args: {
    currentUserId: v.id("appUsers"),
    solutionId: v.id("simulationComparisonSolutions"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    amortizationSchedule: Array<{
      installmentNumber: number;
      dueOffsetMonths: number;
      openingBalance: number;
      interestAmount: number;
      principalAmount: number;
      baseInstallmentAmount: number;
      collectionFeeAmount: number;
      totalInstallmentAmount: number;
      closingBalance: number;
    }>;
    regeneratedSummary: NonNullable<
      ReturnType<typeof regenerateAmortizationFromInputSnapshot>["regeneratedSummary"]
    >;
    summaryMatches: boolean;
    differingFields: string[];
    warnings: string[];
    engineVersionUsed: string;
    snapshotEngineVersion: string;
  }> => {
    // TODO Auth0: identità da ctx.auth
    const snapshot = await ctx.runQuery(
      internal.comparisonQueries.getSolutionSnapshotForRegenerate,
      {
        currentUserId: args.currentUserId,
        solutionId: args.solutionId,
      },
    );

    if (!snapshot.calculationSummary) {
      throw new Error(
        "La soluzione non ha un riepilogo di calcolo da confrontare.",
      );
    }

    const regenerated = regenerateAmortizationFromInputSnapshot({
      calculationInput: snapshot.calculationInputSnapshot,
      expectedSummary: snapshot.calculationSummary,
      snapshotEngineVersion: snapshot.engineVersion,
      currentEngineVersion: FINANCIAL_ENGINE_VERSION,
    });

    if (!regenerated.summaryMatches) {
      console.warn("[regenerateAmortizationScheduleFromSnapshot]", {
        solutionId: args.solutionId as Id<"simulationComparisonSolutions">,
        differingFields: regenerated.differingFields,
      });
    }

    return {
      amortizationSchedule: regenerated.amortizationSchedule,
      regeneratedSummary: regenerated.regeneratedSummary,
      summaryMatches: regenerated.summaryMatches,
      differingFields: regenerated.differingFields,
      warnings: regenerated.warnings,
      engineVersionUsed: FINANCIAL_ENGINE_VERSION,
      snapshotEngineVersion: snapshot.engineVersion,
    };
  },
});
