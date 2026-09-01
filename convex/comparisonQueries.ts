import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireActiveUser, requireAdmin } from "./lib/authHelpers";
import {
  buildSelectedSolutionLabel,
  canProposeSolution,
  hasInputsChangedAfterRun,
} from "./lib/comparisonSnapshotMapper";

/**
 * TODO Auth0:
 * in produzione l'identità dovrà essere ricavata da ctx.auth
 * e non ricevuta liberamente dal client.
 */

const resultGroupOrder = {
  compatible: 0,
  verification_required: 1,
  not_compatible: 2,
} as const;

function sortSolutions(solutions: Doc<"simulationComparisonSolutions">[]) {
  return [...solutions].sort((a, b) => {
    const groupDiff =
      resultGroupOrder[a.resultGroup] - resultGroupOrder[b.resultGroup];
    if (groupDiff !== 0) return groupDiff;
    return a.rankPosition - b.rankPosition;
  });
}

async function assertSimulationAccess(
  ctx: QueryCtx,
  simulationId: Id<"simulations">,
  actorUserId: Id<"appUsers">,
  actorRole: "cm" | "admin",
) {
  const simulation = await ctx.db.get(simulationId);
  if (!simulation) {
    throw new Error("Simulazione non trovata.");
  }
  if (actorRole !== "admin" && simulation.ownerUserId !== actorUserId) {
    throw new Error("Non sei autorizzato ad accedere a questa simulazione.");
  }
  return simulation;
}

export const listComparisonRunsForSimulation = query({
  args: {
    currentUserId: v.id("appUsers"),
    simulationId: v.id("simulations"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: identità da ctx.auth
    const actor = await requireActiveUser(ctx, args.currentUserId);
    const simulation = await assertSimulationAccess(
      ctx,
      args.simulationId,
      args.currentUserId,
      actor.role,
    );

    const runs = await ctx.db
      .query("simulationComparisonRuns")
      .withIndex("by_simulation_created_at", (q) =>
        q.eq("simulationId", args.simulationId),
      )
      .order("desc")
      .collect();

    return runs.map((run) => ({
      ...run,
      isLatest: simulation.latestComparisonRunId === run._id,
      containsProposedSolution:
        simulation.proposedComparisonRunId === run._id,
    }));
  },
});

export const getComparisonRunWithSolutions = query({
  args: {
    currentUserId: v.id("appUsers"),
    comparisonRunId: v.id("simulationComparisonRuns"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: identità da ctx.auth
    const actor = await requireActiveUser(ctx, args.currentUserId);
    const run = await ctx.db.get(args.comparisonRunId);
    if (!run) {
      return null;
    }

    await assertSimulationAccess(
      ctx,
      run.simulationId,
      args.currentUserId,
      actor.role,
    );

    const simulation = await ctx.db.get(run.simulationId);
    const solutions = sortSolutions(
      await ctx.db
        .query("simulationComparisonSolutions")
        .withIndex("by_run", (q) => q.eq("comparisonRunId", run._id))
        .collect(),
    );

    const proposedSolutionId = simulation?.proposedSolutionId;

    return {
      run: {
        ...run,
        isLatest: simulation?.latestComparisonRunId === run._id,
        isHistorical: simulation?.latestComparisonRunId !== run._id,
      },
      solutions,
      proposedSolutionId,
      proposedSolution:
        proposedSolutionId !== undefined
          ? (solutions.find((item) => item._id === proposedSolutionId) ?? null)
          : null,
      inputsChangedAfterRun: hasInputsChangedAfterRun(
        simulation?.lastInputUpdatedAt,
        run.createdAt,
      ),
    };
  },
});

export const getLatestComparisonForSimulation = query({
  args: {
    currentUserId: v.id("appUsers"),
    simulationId: v.id("simulations"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: identità da ctx.auth
    const actor = await requireActiveUser(ctx, args.currentUserId);
    const simulation = await assertSimulationAccess(
      ctx,
      args.simulationId,
      args.currentUserId,
      actor.role,
    );

    if (!simulation.latestComparisonRunId) {
      return null;
    }

    const run = await ctx.db.get(simulation.latestComparisonRunId);
    if (!run) {
      return null;
    }

    const solutions = sortSolutions(
      await ctx.db
        .query("simulationComparisonSolutions")
        .withIndex("by_run", (q) => q.eq("comparisonRunId", run._id))
        .collect(),
    );

    return {
      run: {
        ...run,
        isLatest: true,
        isHistorical: false,
      },
      solutions,
      proposedSolutionId: simulation.proposedSolutionId,
      proposedSolution:
        simulation.proposedSolutionId !== undefined
          ? (solutions.find(
              (item) => item._id === simulation.proposedSolutionId,
            ) ?? null)
          : null,
      inputsChangedAfterRun: hasInputsChangedAfterRun(
        simulation.lastInputUpdatedAt,
        run.createdAt,
      ),
      comparisonStatus: simulation.comparisonStatus ?? "not_started",
    };
  },
});

export const getSolutionSnapshotForRegenerate = internalQuery({
  args: {
    currentUserId: v.id("appUsers"),
    solutionId: v.id("simulationComparisonSolutions"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: identità da ctx.auth
    const actor = await requireActiveUser(ctx, args.currentUserId);
    const solution = await ctx.db.get(args.solutionId);
    if (!solution) {
      throw new Error("Soluzione non trovata.");
    }

    if (actor.role !== "admin" && solution.ownerUserId !== args.currentUserId) {
      throw new Error(
        "Non sei autorizzato a rigenerare il piano di questa soluzione.",
      );
    }

    const run = await ctx.db.get(solution.comparisonRunId);
    if (!run) {
      throw new Error("Confronto non trovato.");
    }

    return {
      calculationInputSnapshot: solution.calculationInputSnapshot,
      calculationSummary: solution.calculationSummary,
      engineVersion: run.engineVersion,
      ownerUserId: solution.ownerUserId,
    };
  },
});

export const selectProposedSolution = mutation({
  args: {
    currentUserId: v.id("appUsers"),
    simulationId: v.id("simulations"),
    comparisonRunId: v.id("simulationComparisonRuns"),
    solutionId: v.id("simulationComparisonSolutions"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: identità da ctx.auth
    const actor = await requireActiveUser(ctx, args.currentUserId);
    if (actor.role === "admin") {
      throw new Error(
        "Gli amministratori non possono selezionare la soluzione proposta.",
      );
    }

    const simulation = await ctx.db.get(args.simulationId);
    if (!simulation) {
      throw new Error("Simulazione non trovata.");
    }
    if (simulation.ownerUserId !== args.currentUserId) {
      throw new Error(
        "Non sei autorizzato a modificare la proposta di questa simulazione.",
      );
    }

    const run = await ctx.db.get(args.comparisonRunId);
    if (!run || run.simulationId !== args.simulationId) {
      throw new Error("Il confronto non appartiene a questa simulazione.");
    }

    const solution = await ctx.db.get(args.solutionId);
    if (
      !solution ||
      solution.comparisonRunId !== args.comparisonRunId ||
      solution.simulationId !== args.simulationId
    ) {
      throw new Error("La soluzione non appartiene a questo confronto.");
    }

    if (
      !canProposeSolution({
        resultGroup: solution.resultGroup,
        hasCalculationSummary: solution.calculationSummary !== undefined,
        solutionOwnerUserId: solution.ownerUserId,
        simulationOwnerUserId: simulation.ownerUserId,
      })
    ) {
      throw new Error(
        "Solo una soluzione compatibile con calcolo valido può essere proposta.",
      );
    }

    const now = Date.now();

    if (simulation.proposedSolutionId) {
      const previous = await ctx.db.get(simulation.proposedSolutionId);
      if (previous && previous.isProposed) {
        await ctx.db.patch(previous._id, {
          isProposed: false,
          proposedAt: undefined,
        });
      }
    }

    await ctx.db.patch(solution._id, {
      isProposed: true,
      proposedAt: now,
    });

    const label = buildSelectedSolutionLabel({
      companyShortName: solution.companySnapshot.shortName,
      tableCode: solution.financialTableSnapshot.tableCode,
      durationMonths: solution.calculationInputSnapshot.durationMonths,
    });

    await ctx.db.patch(args.simulationId, {
      proposedSolutionId: solution._id,
      proposedComparisonRunId: run._id,
      comparisonStatus: "solution_selected",
      status: "proposed",
      selectedSolutionLabel: label,
      proposedAt: now,
      updatedAt: now,
    });

    return {
      proposedSolutionId: solution._id,
      proposedComparisonRunId: run._id,
      selectedSolutionLabel: label,
    };
  },
});

async function buildSimulationComparisonSummary(
  ctx: QueryCtx,
  simulation: Doc<"simulations">,
) {
  const runs = await ctx.db
    .query("simulationComparisonRuns")
    .withIndex("by_simulation", (q) => q.eq("simulationId", simulation._id))
    .collect();

  let proposedSolutionSummary:
    | {
        companyShortName: string;
        productName: string;
        tableCode: string;
        durationMonths: number;
        regularTotalInstallmentAmount?: number;
      }
    | undefined;

  if (simulation.proposedSolutionId) {
    const proposed = await ctx.db.get(simulation.proposedSolutionId);
    if (proposed) {
      proposedSolutionSummary = {
        companyShortName: proposed.companySnapshot.shortName,
        productName: proposed.productSnapshot.name,
        tableCode: proposed.financialTableSnapshot.tableCode,
        durationMonths: proposed.calculationInputSnapshot.durationMonths,
        regularTotalInstallmentAmount:
          proposed.calculationSummary?.regularTotalInstallmentAmount,
      };
    }
  }

  const latestRun = simulation.latestComparisonRunId
    ? await ctx.db.get(simulation.latestComparisonRunId)
    : null;

  return {
    ...simulation,
    comparisonStatus: simulation.comparisonStatus ?? "not_started",
    comparisonRunsCount: runs.length,
    lastComparisonAt: simulation.lastComparisonAt,
    latestRunNumber: latestRun?.runNumber,
    proposedSolutionSummary,
    inputsChangedAfterLatestRun: latestRun
      ? hasInputsChangedAfterRun(
          simulation.lastInputUpdatedAt,
          latestRun.createdAt,
        )
      : false,
  };
}

export const listMySimulationsWithComparisonSummary = query({
  args: {
    currentUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: identità da ctx.auth
    await requireActiveUser(ctx, args.currentUserId);

    const simulations = await ctx.db
      .query("simulations")
      .withIndex("by_owner_updated_at", (q) =>
        q.eq("ownerUserId", args.currentUserId),
      )
      .order("desc")
      .collect();

    return Promise.all(
      simulations.map((simulation) =>
        buildSimulationComparisonSummary(ctx, simulation),
      ),
    );
  },
});

export const listAllSimulationsWithComparisonSummary = query({
  args: {
    actorUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: identità da ctx.auth
    await requireAdmin(ctx, args.actorUserId);

    const simulations = await ctx.db.query("simulations").collect();
    simulations.sort((a, b) => b.updatedAt - a.updatedAt);

    return Promise.all(
      simulations.map((simulation) =>
        buildSimulationComparisonSummary(ctx, simulation),
      ),
    );
  },
});

export const getSimulationComparisonHistoryAdmin = query({
  args: {
    actorUserId: v.id("appUsers"),
    simulationId: v.id("simulations"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: identità da ctx.auth
    await requireAdmin(ctx, args.actorUserId);

    const simulation = await ctx.db.get(args.simulationId);
    if (!simulation) {
      throw new Error("Simulazione non trovata.");
    }

    const runs = await ctx.db
      .query("simulationComparisonRuns")
      .withIndex("by_simulation_created_at", (q) =>
        q.eq("simulationId", args.simulationId),
      )
      .order("desc")
      .collect();

    let proposedSolution: Doc<"simulationComparisonSolutions"> | null = null;
    if (simulation.proposedSolutionId) {
      proposedSolution =
        (await ctx.db.get(simulation.proposedSolutionId)) ?? null;
    }

    return {
      simulation,
      runs: runs.map((run) => ({
        ...run,
        isLatest: simulation.latestComparisonRunId === run._id,
        containsProposedSolution:
          simulation.proposedComparisonRunId === run._id,
      })),
      proposedSolution,
    };
  },
});
