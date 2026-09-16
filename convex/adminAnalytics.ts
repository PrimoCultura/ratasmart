import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/authHelpers";
import {
  chooseTrendGranularity,
  classifyComparisonOutcome,
  classifyRuleTypeToMacro,
  coverageRate,
  inPeriod,
  isSimulationSoftDeleted,
  mean,
  median,
  percent,
  reasonLabelForRuleType,
  trendBucketKey,
  type ComparisonOutcomeClass,
  type ProblemMacroCategory,
} from "../shared/admin-analytics";
import type { ComparisonDiagnostics } from "../shared/alternative-diagnostics";

const networkValidator = v.union(
  v.literal("PCG"),
  v.literal("DES"),
  v.literal("Paoleschi"),
);

type ProductAgg = {
  companyId: string;
  companyShortName: string;
  productId: string;
  productName: string;
  tableCode: string;
  compatible: number;
  verificationRequired: number;
  notCompatible: number;
  amounts: number[];
};

type ReasonAgg = {
  ruleType: string;
  label: string;
  macroCategory: ProblemMacroCategory;
  count: number;
  amounts: number[];
  networks: Record<string, number>;
};

function emptyOutcomeCounts(): Record<ComparisonOutcomeClass, number> {
  return {
    compatible: 0,
    verification_required: 0,
    no_solution: 0,
  };
}

/**
 * Dashboard Control Room: aggregazioni server-side dai dati esistenti.
 * Nessuna tabella simulationAnalyticsEvents (non necessaria).
 */
export const getAdminDashboardAnalytics = query({
  args: {
    actorUserId: v.id("appUsers"),
    fromMs: v.number(),
    toMs: v.number(),
    network: v.optional(networkValidator),
    clinicName: v.optional(v.string()),
    companyId: v.optional(v.string()),
    productId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);

    const users = await ctx.db.query("appUsers").collect();
    const userById = new Map(users.map((user) => [user._id, user]));

    const allSimulations = await ctx.db.query("simulations").collect();
    const activeSimulations = allSimulations.filter(
      (simulation) => !isSimulationSoftDeleted(simulation),
    );

    const clinicFilter =
      args.clinicName && args.clinicName !== "ALL"
        ? args.clinicName.trim().toLowerCase()
        : null;

    const ownerMatchesClinic = (ownerUserId: Id<"appUsers">) => {
      if (!clinicFilter) return true;
      const owner = userById.get(ownerUserId);
      return (owner?.clinicName ?? "").toLowerCase() === clinicFilter;
    };

    let runsQuery = ctx.db
      .query("simulationComparisonRuns")
      .withIndex("by_calculation_date");
    // Convex range: collect then filter by period (index still helps ordered scan)
    const allRuns = await runsQuery.collect();

    const runsInPeriod = allRuns.filter((run) => {
      if (!inPeriod(run.calculationDate, args.fromMs, args.toMs)) return false;
      if (args.network && run.network !== args.network) return false;
      if (!ownerMatchesClinic(run.ownerUserId)) return false;
      return true;
    });

    // Latest run per simulation in period
    const latestRunBySim = new Map<string, Doc<"simulationComparisonRuns">>();
    for (const run of runsInPeriod) {
      const existing = latestRunBySim.get(run.simulationId);
      if (!existing || run.calculationDate > existing.calculationDate) {
        latestRunBySim.set(run.simulationId, run);
      }
    }

    const deletedSimIds = new Set(
      allSimulations
        .filter((simulation) => isSimulationSoftDeleted(simulation))
        .map((simulation) => simulation._id as string),
    );

    let validRuns = [...latestRunBySim.values()].filter(
      (run) => !deletedSimIds.has(run.simulationId),
    );

    // Optional company/product filter: keep runs that have at least one matching solution
    if (args.companyId || args.productId) {
      const filtered: Doc<"simulationComparisonRuns">[] = [];
      for (const run of validRuns) {
        const solutions = await ctx.db
          .query("simulationComparisonSolutions")
          .withIndex("by_run", (q) => q.eq("comparisonRunId", run._id))
          .collect();
        const match = solutions.some((solution) => {
          if (
            args.companyId &&
            solution.companySnapshot.companyId !== args.companyId
          ) {
            return false;
          }
          if (
            args.productId &&
            solution.productSnapshot.productId !== args.productId
          ) {
            return false;
          }
          return true;
        });
        if (match) filtered.push(run);
      }
      validRuns = filtered;
    }

    const outcomeCounts = emptyOutcomeCounts();
    const amounts: number[] = [];
    const durations: number[] = [];
    let zeroInterestCount = 0;
    const networkCounts: Record<string, number> = {};
    const activeOwnerIds = new Set<string>();
    const productMap = new Map<string, ProductAgg>();
    const reasonMap = new Map<string, ReasonAgg>();
    const macroCounts: Record<ProblemMacroCategory, number> = {
      PRODUCT_GAP: 0,
      PATIENT_ELIGIBILITY: 0,
      MISSING_INFORMATION: 0,
      NETWORK_AVAILABILITY: 0,
      OTHER: 0,
    };

    const granularity = chooseTrendGranularity(args.fromMs, args.toMs);
    const trendMap = new Map<
      string,
      {
        simulations: number;
        compatible: number;
        verification_required: number;
        no_solution: number;
      }
    >();

    for (const run of validRuns) {
      const outcome = classifyComparisonOutcome(run);
      outcomeCounts[outcome] += 1;
      amounts.push(run.requestedAmount);
      durations.push(run.selectedDurationMonths);
      networkCounts[run.network] = (networkCounts[run.network] ?? 0) + 1;
      activeOwnerIds.add(run.ownerUserId);

      if (run.patientSnapshot.patientRequestsZeroInterest === true) {
        zeroInterestCount += 1;
      }

      const bucket = trendBucketKey(run.calculationDate, granularity);
      const trend = trendMap.get(bucket) ?? {
        simulations: 0,
        compatible: 0,
        verification_required: 0,
        no_solution: 0,
      };
      trend.simulations += 1;
      trend[outcome] += 1;
      trendMap.set(bucket, trend);

      const solutions = await ctx.db
        .query("simulationComparisonSolutions")
        .withIndex("by_run", (q) => q.eq("comparisonRunId", run._id))
        .collect();

      let rulesCollected = 0;
      for (const solution of solutions) {
        const key = `${solution.companySnapshot.companyId}|${solution.productSnapshot.productId}|${solution.financialTableSnapshot.tableCode}`;
        const agg = productMap.get(key) ?? {
          companyId: solution.companySnapshot.companyId,
          companyShortName: solution.companySnapshot.shortName,
          productId: solution.productSnapshot.productId,
          productName: solution.productSnapshot.name,
          tableCode: solution.financialTableSnapshot.tableCode,
          compatible: 0,
          verificationRequired: 0,
          notCompatible: 0,
          amounts: [],
        };
        if (solution.resultGroup === "compatible") agg.compatible += 1;
        else if (solution.resultGroup === "verification_required") {
          agg.verificationRequired += 1;
        } else agg.notCompatible += 1;
        agg.amounts.push(run.requestedAmount);
        productMap.set(key, agg);

        if (
          outcome !== "compatible" &&
          (solution.resultGroup === "not_compatible" ||
            solution.resultGroup === "verification_required")
        ) {
          const rules =
            solution.resultGroup === "not_compatible"
              ? solution.compatibilitySnapshot.failedRules
              : solution.compatibilitySnapshot.verificationRules;
          for (const rule of rules) {
            const ruleType = rule.ruleType || "other";
            const macro = classifyRuleTypeToMacro(ruleType);
            const reason = reasonMap.get(ruleType) ?? {
              ruleType,
              label: reasonLabelForRuleType(ruleType),
              macroCategory: macro,
              count: 0,
              amounts: [],
              networks: {},
            };
            reason.count += 1;
            reason.amounts.push(run.requestedAmount);
            reason.networks[run.network] =
              (reason.networks[run.network] ?? 0) + 1;
            reasonMap.set(ruleType, reason);
            macroCounts[macro] += 1;
            rulesCollected += 1;
          }
        }
      }

      const diagnostics = run.diagnosticsSnapshot as
        | ComparisonDiagnostics
        | undefined;
      if (
        outcome !== "compatible" &&
        rulesCollected === 0 &&
        diagnostics?.blockingConstraints?.length
      ) {
        for (const constraint of diagnostics.blockingConstraints) {
          const ruleType = constraint.type;
          const macro = classifyRuleTypeToMacro(ruleType);
          const reason = reasonMap.get(ruleType) ?? {
            ruleType,
            label: constraint.label || reasonLabelForRuleType(ruleType),
            macroCategory: macro,
            count: 0,
            amounts: [],
            networks: {},
          };
          reason.count += 1;
          reason.amounts.push(run.requestedAmount);
          reason.networks[run.network] =
            (reason.networks[run.network] ?? 0) + 1;
          reasonMap.set(ruleType, reason);
          macroCounts[macro] += 1;
        }
      }
    }

    const simulationsCreatedInPeriod = activeSimulations.filter(
      (simulation) => {
        if (!inPeriod(simulation.createdAt, args.fromMs, args.toMs)) {
          return false;
        }
        if (args.network && simulation.network !== args.network) return false;
        if (!ownerMatchesClinic(simulation.ownerUserId)) return false;
        return true;
      },
    ).length;

    const withCompatible = outcomeCounts.compatible;
    const withValidComparison = validRuns.length;
    const coverage = coverageRate({
      withCompatible,
      withValidComparison,
    });
    const noSolutionRate = percent(
      outcomeCounts.no_solution,
      withValidComparison,
    );
    const verificationRate = percent(
      outcomeCounts.verification_required,
      withValidComparison,
    );

    const totalUsers = users.filter((user) => !user.anonymizedAt).length;
    const activeUsers = activeOwnerIds.size;
    const activeUsersRate = percent(activeUsers, totalUsers);

    const amountMean = mean(amounts);
    const amountMedian = median(amounts);

    const problemTotal = [...reasonMap.values()].reduce(
      (acc, item) => acc + item.count,
      0,
    );

    const topReasons = [...reasonMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map((item) => ({
        ruleType: item.ruleType,
        label: item.label,
        macroCategory: item.macroCategory,
        count: item.count,
        percent: percent(item.count, problemTotal),
        averageAmount: mean(item.amounts),
        networks: item.networks,
      }));

    const productCoverage = [...productMap.values()]
      .map((item) => {
        const evaluated =
          item.compatible + item.verificationRequired + item.notCompatible;
        return {
          companyId: item.companyId,
          companyShortName: item.companyShortName,
          productId: item.productId,
          productName: item.productName,
          tableCode: item.tableCode,
          compatible: item.compatible,
          verificationRequired: item.verificationRequired,
          notCompatible: item.notCompatible,
          evaluated,
          compatibilityRate: percent(item.compatible, evaluated),
          averageRequestedAmount: mean(item.amounts),
        };
      })
      .sort((a, b) => b.evaluated - a.evaluated)
      .slice(0, 40);

    const trend = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, values]) => ({
        bucket,
        simulations: values.simulations,
        coverageRate: coverageRate({
          withCompatible: values.compatible,
          withValidComparison: values.simulations,
        }),
        noSolutionRate: percent(values.no_solution, values.simulations),
        verificationRate: percent(
          values.verification_required,
          values.simulations,
        ),
      }));

    return {
      period: { fromMs: args.fromMs, toMs: args.toMs, granularity },
      filtersApplied: {
        network: args.network ?? null,
        clinicName: clinicFilter,
        companyId: args.companyId ?? null,
        productId: args.productId ?? null,
        /** Network sul profilo utente non esiste in schema. */
        userNetworkUnavailable: true,
      },
      kpis: {
        simulationsCreated: simulationsCreatedInPeriod,
        comparisonsValid: withValidComparison,
        averageRequestedAmount: amountMean,
        medianRequestedAmount: amountMedian,
        activeUsers,
        totalUsers,
        activeUsersRate,
        coverageRate: coverage,
        noSolutionRate,
        verificationRequiredRate: verificationRate,
      },
      outcomeBreakdown: outcomeCounts,
      demand: {
        averageRequestedAmount: amountMean,
        medianRequestedAmount: amountMedian,
        averageSelectedDurationMonths: mean(durations),
        zeroInterestRequestRate: percent(zeroInterestCount, withValidComparison),
        networkCounts,
        amountBuckets: buildAmountBuckets(amounts),
      },
      productCoverage,
      topReasons,
      macroCategoryCounts: macroCounts,
      trend,
      empty: withValidComparison === 0 && simulationsCreatedInPeriod === 0,
    };
  },
});

function buildAmountBuckets(amounts: number[]) {
  const buckets = [
    { label: "≤ 2.000", min: 0, max: 2000, count: 0 },
    { label: "2.001–4.000", min: 2001, max: 4000, count: 0 },
    { label: "4.001–6.000", min: 4001, max: 6000, count: 0 },
    { label: "6.001–10.000", min: 6001, max: 10000, count: 0 },
    { label: "> 10.000", min: 10001, max: Number.POSITIVE_INFINITY, count: 0 },
  ];
  for (const amount of amounts) {
    const bucket = buckets.find((item) => amount >= item.min && amount <= item.max);
    if (bucket) bucket.count += 1;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}

export const listAdminSimulationsGovernance = query({
  args: {
    actorUserId: v.id("appUsers"),
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
    network: v.optional(networkValidator),
    clinicName: v.optional(v.string()),
    ownerUserId: v.optional(v.id("appUsers")),
    includeDeleted: v.optional(v.boolean()),
    outcome: v.optional(
      v.union(
        v.literal("compatible"),
        v.literal("verification_required"),
        v.literal("no_solution"),
        v.literal("no_comparison"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);

    const users = await ctx.db.query("appUsers").collect();
    const userById = new Map(users.map((user) => [user._id, user]));
    const clinicFilter =
      args.clinicName && args.clinicName !== "ALL"
        ? args.clinicName.trim().toLowerCase()
        : null;

    let simulations = await ctx.db.query("simulations").collect();
    simulations.sort((a, b) => b.updatedAt - a.updatedAt);

    if (!args.includeDeleted) {
      simulations = simulations.filter(
        (simulation) => !isSimulationSoftDeleted(simulation),
      );
    }
    if (args.network) {
      simulations = simulations.filter(
        (simulation) => simulation.network === args.network,
      );
    }
    if (args.ownerUserId) {
      simulations = simulations.filter(
        (simulation) => simulation.ownerUserId === args.ownerUserId,
      );
    }
    if (args.fromMs !== undefined && args.toMs !== undefined) {
      simulations = simulations.filter((simulation) =>
        inPeriod(simulation.createdAt, args.fromMs!, args.toMs!),
      );
    }
    if (clinicFilter) {
      simulations = simulations.filter((simulation) => {
        const owner = userById.get(simulation.ownerUserId);
        return (owner?.clinicName ?? "").toLowerCase() === clinicFilter;
      });
    }

    const rows = [];
    for (const simulation of simulations.slice(0, 300)) {
      const owner = userById.get(simulation.ownerUserId);
      const latestRun = simulation.latestComparisonRunId
        ? await ctx.db.get(simulation.latestComparisonRunId)
        : null;
      const outcome = latestRun
        ? classifyComparisonOutcome(latestRun)
        : ("no_comparison" as const);
      if (args.outcome && outcome !== args.outcome) continue;

      rows.push({
        _id: simulation._id,
        createdAt: simulation.createdAt,
        updatedAt: simulation.updatedAt,
        network: simulation.network,
        requestedAmount: simulation.requestedAmount,
        requestedDurationMonths: simulation.requestedDurationMonths,
        selectedDurationMonths: latestRun?.selectedDurationMonths,
        comparisonStatus: simulation.comparisonStatus ?? "not_started",
        outcome,
        compatibleSolutionsCount: latestRun?.compatibleSolutionsCount ?? 0,
        verificationRequiredSolutionsCount:
          latestRun?.verificationRequiredSolutionsCount ?? 0,
        ownerUserId: simulation.ownerUserId,
        ownerDisplayName: owner?.displayName ?? "—",
        clinicName: owner?.clinicName,
        isDeleted: isSimulationSoftDeleted(simulation),
        deletionReason: simulation.deletionReason,
        deletedAt: simulation.deletedAt,
        patientLabel: `${simulation.patientFirstName} ${simulation.patientLastName}`,
      });
    }

    return rows;
  },
});

export const listFilterOptions = query({
  args: { actorUserId: v.id("appUsers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const users = await ctx.db.query("appUsers").collect();
    const clinics = [
      ...new Set(
        users
          .map((user) => user.clinicName?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ].sort();
    const companies = await ctx.db.query("financialCompanies").collect();
    const products = await ctx.db.query("financialProducts").collect();
    return {
      clinics,
      companies: companies
        .filter((company) => company.isActive)
        .map((company) => ({
          id: company._id,
          name: company.shortName ?? company.name,
        })),
      products: products
        .filter((product) => product.isActive)
        .map((product) => ({
          id: product._id,
          companyId: product.companyId,
          name: product.name,
        })),
      users: users
        .filter((user) => user.role === "cm" && !user.anonymizedAt)
        .map((user) => ({
          id: user._id,
          displayName: user.displayName,
          clinicName: user.clinicName,
        })),
    };
  },
});
