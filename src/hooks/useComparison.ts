import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";

export function useComparisonRuns(simulationId: Id<"simulations"> | null) {
  const { userId } = useCurrentUser();
  return useQuery(
    api.comparisonQueries.listComparisonRunsForSimulation,
    userId && simulationId
      ? { currentUserId: userId, simulationId }
      : "skip",
  );
}

export function useComparisonRun(
  comparisonRunId: Id<"simulationComparisonRuns"> | null,
) {
  const { userId } = useCurrentUser();
  return useQuery(
    api.comparisonQueries.getComparisonRunWithSolutions,
    userId && comparisonRunId
      ? { currentUserId: userId, comparisonRunId }
      : "skip",
  );
}

export function useLatestComparison(simulationId: Id<"simulations"> | null) {
  const { userId } = useCurrentUser();
  return useQuery(
    api.comparisonQueries.getLatestComparisonForSimulation,
    userId && simulationId
      ? { currentUserId: userId, simulationId }
      : "skip",
  );
}

export function useSelectProposedSolution() {
  const { userId } = useCurrentUser();
  const selectProposed = useMutation(
    api.comparisonQueries.selectProposedSolution,
  );
  const [isSelecting, setIsSelecting] = useState(false);

  const select = useCallback(
    async (input: {
      simulationId: Id<"simulations">;
      comparisonRunId: Id<"simulationComparisonRuns">;
      solutionId: Id<"simulationComparisonSolutions">;
    }) => {
      if (!userId) {
        throw new Error("Profilo non selezionato.");
      }
      setIsSelecting(true);
      try {
        const result = await selectProposed({
          currentUserId: userId,
          ...input,
        });
        toast.success("Soluzione proposta salvata");
        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Impossibile salvare la soluzione proposta.";
        toast.error(message);
        throw error;
      } finally {
        setIsSelecting(false);
      }
    },
    [selectProposed, userId],
  );

  return { select, isSelecting };
}

export function useMySimulationsWithSummary() {
  const { userId } = useCurrentUser();
  return useQuery(
    api.comparisonQueries.listMySimulationsWithComparisonSummary,
    userId ? { currentUserId: userId } : "skip",
  );
}

export function useAdminSimulationsWithSummary() {
  const { userId } = useCurrentUser();
  return useQuery(
    api.comparisonQueries.listAllSimulationsWithComparisonSummary,
    userId ? { actorUserId: userId } : "skip",
  );
}

export function useAdminSimulationHistory(
  simulationId: Id<"simulations"> | null,
) {
  const { userId } = useCurrentUser();
  return useQuery(
    api.comparisonQueries.getSimulationComparisonHistoryAdmin,
    userId && simulationId
      ? { actorUserId: userId, simulationId }
      : "skip",
  );
}

export function createComparisonRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
