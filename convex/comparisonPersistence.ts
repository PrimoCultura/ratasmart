import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { FINANCIAL_ENGINE_VERSION } from "../shared/financial-engine/index";
import { POLICY_ENGINE_VERSION } from "../shared/policy-engine/index";
import type { SimulationComparisonResult } from "../shared/policy-engine/types";
import {
  mapAllSolutionsFromComparison,
  mapRuntimeComparisonToRunFields,
  nextRunNumber,
  stripUndefinedDeep,
  type MessagePayloadForSnapshot,
  type PatientSnapshot,
  type ProductMetadataForSnapshot,
  type TableMetadataForSnapshot,
} from "./lib/comparisonSnapshotMapper";

const sourceValidator = v.union(
  v.literal("initial_calculation"),
  v.literal("manual_recalculation"),
);
const employmentTypeValidator = v.union(
  v.literal("permanent_employee"),
  v.literal("temporary_employee"),
  v.literal("pensioner"),
  v.literal("self_employed"),
  v.literal("unemployed"),
  v.literal("student"),
  v.literal("housewife"),
  v.literal("other"),
);

/**
 * Persiste atomicamente un run di confronto + tutte le soluzioni.
 * Idempotente su `requestId`. Non modifica `proposedSolutionId`.
 */
export const persistComparisonRun = internalMutation({
  args: {
    simulationId: v.id("simulations"),
    ownerUserId: v.id("appUsers"),
    requestId: v.string(),
    source: sourceValidator,
    calculationDate: v.number(),
    requestedAmount: v.number(),
    patientSnapshot: v.object({
      firstName: v.string(),
      lastName: v.string(),
      age: v.number(),
      employmentType: employmentTypeValidator,
      temporaryContractExpiry: v.optional(v.number()),
      isNonEuCitizen: v.boolean(),
      residencePermitExpiry: v.optional(v.number()),
      hasResidencePermitRenewalReceiptOnly: v.optional(v.boolean()),
      employmentStartDate: v.optional(v.string()),
      employmentSeniorityMonths: v.optional(v.number()),
      seniorityReferenceDate: v.optional(v.number()),
      hasGuarantor: v.optional(v.boolean()),
    }),
    result: v.any(),
    messagesById: v.any(),
    tables: v.array(v.any()),
    products: v.array(v.any()),
    diagnosticsSnapshot: v.optional(v.any()),
    alternativeDiagnosticsVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("simulationComparisonRuns")
      .withIndex("by_request_id", (q) => q.eq("requestId", args.requestId))
      .unique();

    if (existing) {
      const solutions = await ctx.db
        .query("simulationComparisonSolutions")
        .withIndex("by_run", (q) => q.eq("comparisonRunId", existing._id))
        .collect();

      const runtimeToPersistentIds: Record<string, Id<"simulationComparisonSolutions">> =
        {};
      for (const solution of solutions) {
        runtimeToPersistentIds[solution.runtimeSolutionId] = solution._id;
      }

      return {
        comparisonRunId: existing._id,
        runNumber: existing.runNumber,
        runtimeToPersistentIds,
        wasDuplicate: true as const,
      };
    }

    const simulation = await ctx.db.get(args.simulationId);
    if (!simulation) {
      throw new Error("Simulazione non trovata.");
    }
    if (simulation.ownerUserId !== args.ownerUserId) {
      throw new Error("Owner della simulazione non coerente.");
    }

    const previousRuns = await ctx.db
      .query("simulationComparisonRuns")
      .withIndex("by_simulation", (q) => q.eq("simulationId", args.simulationId))
      .collect();

    const existingMax =
      previousRuns.length === 0
        ? undefined
        : Math.max(...previousRuns.map((run) => run.runNumber));
    const runNumber = nextRunNumber(existingMax);
    const createdAt = args.calculationDate;

    const result = args.result as SimulationComparisonResult;
    const patientSnapshot = stripUndefinedDeep(
      args.patientSnapshot as PatientSnapshot,
    );

    const runFields = mapRuntimeComparisonToRunFields({
      result,
      patientSnapshot,
      requestedAmount: args.requestedAmount,
      engineVersion: FINANCIAL_ENGINE_VERSION,
      policyEngineVersion: POLICY_ENGINE_VERSION,
      source: args.source,
    });

    const tablesById: Record<string, TableMetadataForSnapshot> = {};
    for (const table of args.tables as TableMetadataForSnapshot[]) {
      tablesById[table.id] = table;
    }

    const productsById: Record<string, ProductMetadataForSnapshot> = {};
    for (const product of args.products as ProductMetadataForSnapshot[]) {
      productsById[product.id] = product;
    }

    const messagesById = args.messagesById as Record<
      string,
      MessagePayloadForSnapshot
    >;

    const solutionFields = mapAllSolutionsFromComparison({
      result,
      tablesById,
      productsById,
      messagesById,
      requestedAmount: args.requestedAmount,
    });

    const comparisonRunId = await ctx.db.insert("simulationComparisonRuns", {
      simulationId: args.simulationId,
      ownerUserId: args.ownerUserId,
      requestId: args.requestId,
      runNumber,
      createdAt,
      ...stripUndefinedDeep(runFields),
      diagnosticsSnapshot: args.diagnosticsSnapshot,
      alternativeDiagnosticsVersion: args.alternativeDiagnosticsVersion,
    });

    const runtimeToPersistentIds: Record<
      string,
      Id<"simulationComparisonSolutions">
    > = {};

    for (const fields of solutionFields) {
      const solutionId = await ctx.db.insert("simulationComparisonSolutions", {
        comparisonRunId,
        simulationId: args.simulationId,
        ownerUserId: args.ownerUserId,
        isProposed: false,
        createdAt,
        ...stripUndefinedDeep(fields),
      });
      runtimeToPersistentIds[fields.runtimeSolutionId] = solutionId;
    }

    // Non toccare proposedSolutionId / proposedComparisonRunId.
    await ctx.db.patch(args.simulationId, {
      latestComparisonRunId: comparisonRunId,
      lastComparisonAt: createdAt,
      comparisonStatus: "calculated",
      updatedAt: createdAt,
    });

    return {
      comparisonRunId,
      runNumber,
      runtimeToPersistentIds,
      wasDuplicate: false as const,
    };
  },
});
