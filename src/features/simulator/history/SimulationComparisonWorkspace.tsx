import { useCallback, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { collectComparisonDurationOptions } from "../../../../shared/alternative-diagnostics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/common/LoadingState";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import {
  createComparisonRequestId,
  useComparisonRun,
  useComparisonRuns,
  useLatestComparison,
  useSelectProposedSolution,
} from "@/hooks";
import { AskVirtualMarcoButton } from "@/features/chat/ChatPage";
import { ComparisonHistory } from "./ComparisonHistory";
import { HistoricalComparisonView } from "./HistoricalComparisonView";
import { RecalculateComparisonDialog } from "./RecalculateComparisonDialog";
import { SimulationDataChangedAlert } from "./SimulationDataChangedAlert";

type ViewMode = "latest" | "historical";

type SimulationComparisonWorkspaceProps = {
  simulation: Doc<"simulations">;
  readOnly?: boolean;
  onEditData?: () => void;
};

export function SimulationComparisonWorkspace({
  simulation,
  readOnly = false,
  onEditData,
}: SimulationComparisonWorkspaceProps) {
  const { userId } = useCurrentUser();
  const calculateComparison = useAction(
    api.comparison.calculateSimulationComparison,
  );
  const { select: selectProposed } = useSelectProposedSolution();
  const activeTables = useQuery(api.financialTables.listActiveFinancialTables, {
    network: simulation.network,
  });

  const [viewMode, setViewMode] = useState<ViewMode>("latest");
  const [selectedRunId, setSelectedRunId] = useState<
    Id<"simulationComparisonRuns"> | null
  >(null);
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isDurationRecalc, setIsDurationRecalc] = useState(false);

  const runs = useComparisonRuns(simulation._id);
  const latest = useLatestComparison(simulation._id);
  const historical = useComparisonRun(
    viewMode === "historical" ? selectedRunId : null,
  );

  const activeBundle = viewMode === "historical" ? historical : latest;
  const hasProposal = simulation.proposedSolutionId !== undefined;
  const inputsChanged = latest?.inputsChangedAfterRun === true;

  const durationOptions = useMemo(() => {
    if (!activeTables) return [];
    return collectComparisonDurationOptions({
      tables: activeTables.map((table) => ({
        id: table._id,
        companyId: table.companyId,
        productId: table.productId,
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
        durationTerms: table.durationTerms,
        customerTanPercent: table.customerTanPercent,
        openingFeeType: table.openingFeeType,
        openingFeeValue: table.openingFeeValue,
        collectionFeePerInstallment: table.collectionFeePerInstallment,
        installmentFeeType: table.installmentFeeType,
        installmentFeeValue: table.installmentFeeValue,
        internalCostPercentAt24Months: table.internalCostPercentAt24Months,
        internalCostBase: table.internalCostBase,
        firstInstallmentDelayDays: table.firstInstallmentDelayDays,
        requiresManagerAuthorizationNotice:
          table.requiresManagerAuthorizationNotice,
        isActive: table.isActive,
      })),
      requestedAmount: simulation.requestedAmount ?? 0,
      firstInstallmentDelayDays:
        activeBundle?.run.selectedFirstInstallmentDelayDays ??
        simulation.preferredFirstInstallmentDelayDays ??
        30,
    });
  }, [
    activeTables,
    activeBundle?.run.selectedFirstInstallmentDelayDays,
    simulation.preferredFirstInstallmentDelayDays,
    simulation.requestedAmount,
  ]);

  const openLatest = useCallback(() => {
    setViewMode("latest");
    setSelectedRunId(null);
  }, []);

  const openHistorical = useCallback(
    (runId: Id<"simulationComparisonRuns">) => {
      if (latest?.run._id === runId) {
        openLatest();
        return;
      }
      setSelectedRunId(runId);
      setViewMode("historical");
    },
    [latest?.run._id, openLatest],
  );

  const runComparison = useCallback(
    async (input: {
      source: "initial_calculation" | "manual_recalculation";
      selectedDurationMonths?: number;
      selectedFirstInstallmentDelayDays?: 30 | 60 | 90;
    }) => {
      if (!userId) {
        throw new Error("Profilo non selezionato.");
      }
      const result = await calculateComparison({
        currentUserId: userId,
        simulationId: simulation._id,
        requestId: createComparisonRequestId(),
        source: input.source,
        selectedDurationMonths: input.selectedDurationMonths,
        selectedFirstInstallmentDelayDays:
          input.selectedFirstInstallmentDelayDays,
      });
      setViewMode("latest");
      setSelectedRunId(
        result.comparisonRunId as Id<"simulationComparisonRuns">,
      );
      return result;
    },
    [calculateComparison, simulation._id, userId],
  );

  const handleRecalculate = async () => {
    if (readOnly || isRecalculating) return;
    setIsRecalculating(true);
    try {
      await runComparison({ source: "manual_recalculation" });
      toast.success("Nuovo confronto creato");
      setRecalcOpen(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossibile creare il nuovo confronto.";
      toast.error(message);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleInitialCalculate = async () => {
    if (readOnly || isRecalculating) return;
    setIsRecalculating(true);
    try {
      await runComparison({ source: "initial_calculation" });
      toast.success("Confronto calcolato");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossibile calcolare il confronto.";
      toast.error(message);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleDurationChange = async (durationMonths: number) => {
    if (readOnly || viewMode === "historical" || isDurationRecalc) return;
    setIsDurationRecalc(true);
    try {
      await runComparison({
        source: "manual_recalculation",
        selectedDurationMonths: durationMonths,
      });
      toast.success("Confronto aggiornato sulla nuova durata");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossibile aggiornare la durata.";
      toast.error(message);
    } finally {
      setIsDurationRecalc(false);
    }
  };

  const handlePropose = async (
    solutionId: Id<"simulationComparisonSolutions">,
  ) => {
    const runId =
      viewMode === "historical" && selectedRunId
        ? selectedRunId
        : latest?.run._id;
    if (!runId) {
      toast.error("Confronto non disponibile.");
      return;
    }
    await selectProposed({
      simulationId: simulation._id,
      comparisonRunId: runId,
      solutionId,
    });
  };

  if (latest === undefined || runs === undefined) {
    return <LoadingState label="Caricamento confronti…" />;
  }

  if (latest === null) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Nessun confronto ancora calcolato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Calcola le soluzioni disponibili con i dati paziente e le
              condizioni finanziarie attive.
            </p>
            {!readOnly ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={isRecalculating}
                  onClick={() => void handleInitialCalculate()}
                >
                  {isRecalculating ? "Calcolo in corso…" : "Trova le soluzioni"}
                </Button>
                {onEditData ? (
                  <Button type="button" variant="outline" onClick={onEditData}>
                    Modifica dati
                  </Button>
                ) : null}
                <AskVirtualMarcoButton simulationId={simulation._id} />
              </div>
            ) : null}
          </CardContent>
        </Card>
        <ComparisonHistory
          runs={runs}
          selectedRunId={selectedRunId}
          onOpenRun={openHistorical}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {inputsChanged && viewMode === "latest" && !readOnly ? (
        <SimulationDataChangedAlert
          disabled={isRecalculating}
          onRecalculate={() => setRecalcOpen(true)}
        />
      ) : null}

      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isRecalculating}
            onClick={() => setRecalcOpen(true)}
          >
            Ricalcola con le condizioni attuali
          </Button>
          {onEditData ? (
            <Button type="button" variant="outline" onClick={onEditData}>
              Modifica dati
            </Button>
          ) : null}
          <AskVirtualMarcoButton
            simulationId={simulation._id}
            comparisonRunId={
              viewMode === "historical" && selectedRunId
                ? selectedRunId
                : latest.run._id
            }
          />
        </div>
      ) : null}

      <ComparisonHistory
        runs={runs}
        selectedRunId={
          viewMode === "historical" ? selectedRunId : latest.run._id
        }
        onOpenRun={openHistorical}
      />

      <HistoricalComparisonView
        bundle={activeBundle}
        readOnly={readOnly}
        hasExistingProposal={hasProposal}
        onPropose={readOnly ? undefined : handlePropose}
        onBackToLatest={viewMode === "historical" ? openLatest : undefined}
        showDurationSelector={!readOnly && viewMode === "latest"}
        availableDurations={durationOptions}
        onChangeDuration={handleDurationChange}
        isRecalculatingDuration={isDurationRecalc}
      />

      <RecalculateComparisonDialog
        open={recalcOpen}
        onOpenChange={setRecalcOpen}
        onConfirm={() => void handleRecalculate()}
        isLoading={isRecalculating}
      />
    </div>
  );
}
