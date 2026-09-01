import { Link } from "react-router-dom";
import { MessageSquare, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { ComparisonStatusBadge } from "@/components/common/StatusBadge";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { formatCurrency, formatDateTime } from "@/lib/formatting/currency";
import { useMySimulationsWithSummary } from "@/hooks";
import { ProposedSolutionBadge } from "@/features/simulator/history/ProposedSolutionBadge";

export function DashboardPage() {
  const { user } = useCurrentUser();
  const simulations = useMySimulationsWithSummary();

  if (!user || simulations === undefined) {
    return <LoadingState />;
  }

  const savedCount = simulations.length;
  const withComparison = simulations.filter(
    (item) => item.comparisonRunsCount > 0,
  ).length;
  const proposedCount = simulations.filter(
    (item) =>
      item.status === "proposed" ||
      item.comparisonStatus === "solution_selected",
  ).length;
  const lastActivity = simulations[0]?.updatedAt;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Ciao, ${user.firstName}`}
        description="Prepara una nuova simulazione o consulta Virtual Marco per supporto operativo."
        actions={
          <>
            <Button asChild>
              <Link to="/app/simulator">
                <PlusCircle />
                Nuova simulazione
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/chat">
                <MessageSquare />
                Apri Virtual Marco
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Simulazioni salvate" value={String(savedCount)} />
        <MetricCard
          title="Con almeno un confronto"
          value={String(withComparison)}
        />
        <MetricCard
          title="Proposte contrassegnate"
          value={String(proposedCount)}
        />
        <MetricCard
          title="Ultima attività"
          value={lastActivity ? formatDateTime(lastActivity) : "Nessuna"}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Ultime simulazioni</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/history">Vedi tutte</Link>
          </Button>
        </div>

        {simulations.length === 0 ? (
          <EmptyState
            title="Nessuna simulazione ancora"
            description="Crea la prima simulazione per confrontare le condizioni."
            action={
              <Button asChild>
                <Link to="/app/simulator">Nuova simulazione</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {simulations.slice(0, 5).map((simulation) => (
              <Link
                key={simulation._id}
                to={`/app/history/${simulation._id}`}
                className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 transition hover:border-primary/30"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {simulation.patientFirstName} {simulation.patientLastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {simulation.network} ·{" "}
                    {formatCurrency(simulation.requestedAmount)} ·{" "}
                    {formatDateTime(simulation.updatedAt)}
                    {simulation.lastComparisonAt
                      ? ` · confronto ${formatDateTime(simulation.lastComparisonAt)}`
                      : ""}
                  </p>
                  {simulation.proposedSolutionSummary ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <ProposedSolutionBadge />
                      <span className="text-muted-foreground">
                        {simulation.proposedSolutionSummary.companyShortName} ·{" "}
                        {simulation.proposedSolutionSummary.tableCode}
                      </span>
                    </div>
                  ) : null}
                </div>
                <ComparisonStatusBadge
                  comparisonStatus={simulation.comparisonStatus}
                  simulationStatus={simulation.status}
                />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
