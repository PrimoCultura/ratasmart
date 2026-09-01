import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { ComparisonStatusBadge } from "@/components/common/StatusBadge";
import {
  EMPLOYMENT_TYPE_LABELS,
  type EmploymentType,
} from "@/lib/constants/financial";
import { formatCurrency, formatDateTime } from "@/lib/formatting/currency";
import {
  useAdminSimulationHistory,
  useComparisonRun,
} from "@/hooks";
import { ComparisonHistory } from "@/features/simulator/history/ComparisonHistory";
import { HistoricalComparisonView } from "@/features/simulator/history/HistoricalComparisonView";
import { ProposedSolutionBadge } from "@/features/simulator/history/ProposedSolutionBadge";

export function AdminSimulationDetailPage() {
  const { simulationId } = useParams<{ simulationId: string }>();
  const history = useAdminSimulationHistory(
    simulationId ? (simulationId as Id<"simulations">) : null,
  );
  const [selectedRunId, setSelectedRunId] = useState<
    Id<"simulationComparisonRuns"> | null
  >(null);

  const owner = useQuery(
    api.users.getUserById,
    history?.simulation.ownerUserId
      ? { userId: history.simulation.ownerUserId }
      : "skip",
  );

  const selectedRun =
    selectedRunId ??
    history?.simulation.latestComparisonRunId ??
    history?.runs[0]?._id ??
    null;

  const bundle = useComparisonRun(selectedRun);
  // Admin can use getComparisonRunWithSolutions - it allows admin via assertSimulationAccess

  if (history === undefined) {
    return <LoadingState />;
  }

  if (!history) {
    return (
      <ErrorState
        title="Simulazione non trovata"
        message="La simulazione richiesta non è disponibile."
      />
    );
  }

  const { simulation, runs, proposedSolution } = history;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${simulation.patientFirstName} ${simulation.patientLastName}`}
        description="Consultazione admin in sola lettura."
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/simulazioni">Torna alle simulazioni</Link>
          </Button>
        }
      />

      <Badge variant="outline">Consultazione admin – sola lettura</Badge>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2">
          <CardTitle>Dati simulazione</CardTitle>
          <ComparisonStatusBadge
            comparisonStatus={simulation.comparisonStatus}
            simulationStatus={simulation.status}
          />
          {proposedSolution ? <ProposedSolutionBadge /> : null}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info
            label="CM"
            value={owner?.displayName ?? String(simulation.ownerUserId)}
          />
          <Info label="Clinica" value={owner?.clinicName ?? "—"} />
          <Info label="Rete" value={simulation.network} />
          <Info
            label="Importo"
            value={formatCurrency(simulation.requestedAmount)}
          />
          <Info
            label="Età"
            value={
              simulation.patientAge !== undefined
                ? String(simulation.patientAge)
                : "—"
            }
          />
          <Info
            label="Lavoro"
            value={
              simulation.employmentType
                ? EMPLOYMENT_TYPE_LABELS[
                    simulation.employmentType as EmploymentType
                  ]
                : "—"
            }
          />
          <Info
            label="Ultimo aggiornamento"
            value={formatDateTime(simulation.updatedAt)}
          />
          <Info
            label="Confronti"
            value={String(runs.length)}
          />
          {proposedSolution ? (
            <Info
              label="Proposta attiva"
              value={`${proposedSolution.companySnapshot.shortName} · ${proposedSolution.financialTableSnapshot.tableCode}`}
            />
          ) : null}
        </CardContent>
      </Card>

      <ComparisonHistory
        runs={runs}
        selectedRunId={selectedRun}
        onOpenRun={setSelectedRunId}
      />

      <HistoricalComparisonView
        bundle={bundle}
        readOnly
        hasExistingProposal={simulation.proposedSolutionId !== undefined}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
