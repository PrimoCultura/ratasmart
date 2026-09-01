import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { ComparisonStatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/formatting/currency";
import { useAdminSimulationsWithSummary } from "@/hooks";
import { ProposedSolutionBadge } from "@/features/simulator/history/ProposedSolutionBadge";
import { Link } from "react-router-dom";

export function AdminSimulationsPage() {
  const simulations = useAdminSimulationsWithSummary();
  const users = useQuery(api.users.listDemoCmUsers);

  if (simulations === undefined || users === undefined) {
    return <LoadingState />;
  }

  const userMap = new Map(users.map((user) => [user._id, user]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulazioni"
        description="Consultazione admin in sola lettura di tutte le simulazioni CM."
      />
      <Badge variant="outline">Consultazione admin – sola lettura</Badge>

      {simulations.length === 0 ? (
        <EmptyState
          title="Nessuna simulazione"
          description="Quando i CM creeranno simulazioni, appariranno qui."
        />
      ) : (
        <div className="space-y-2">
          {simulations.map((simulation) => {
            const owner = userMap.get(simulation.ownerUserId);
            return (
              <div
                key={simulation._id}
                className="flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {simulation.patientFirstName}{" "}
                      {simulation.patientLastName}
                    </p>
                    <ComparisonStatusBadge
                      comparisonStatus={simulation.comparisonStatus}
                      simulationStatus={simulation.status}
                    />
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {simulation.network}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    CM: {owner?.displayName ?? simulation.ownerUserId}
                    {owner?.clinicName ? ` · ${owner.clinicName}` : ""} ·{" "}
                    {formatCurrency(simulation.requestedAmount)} ·{" "}
                    {simulation.comparisonRunsCount} confronti
                    {simulation.lastComparisonAt
                      ? ` · ultimo ${formatDateTime(simulation.lastComparisonAt)}`
                      : ""}
                  </p>
                  {simulation.proposedSolutionSummary ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <ProposedSolutionBadge />
                      <span className="text-muted-foreground">
                        {simulation.proposedSolutionSummary.companyShortName} ·{" "}
                        {simulation.proposedSolutionSummary.productName} ·{" "}
                        {simulation.proposedSolutionSummary.tableCode} ·{" "}
                        {simulation.proposedSolutionSummary.durationMonths} mesi
                      </span>
                    </div>
                  ) : null}
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/admin/simulazioni/${simulation._id}`}>Apri</Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
