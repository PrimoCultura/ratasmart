import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "convex/react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { ComparisonStatusBadge } from "@/components/common/StatusBadge";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { formatCurrency, formatDateTime } from "@/lib/formatting/currency";
import { useMySimulationsWithSummary } from "@/hooks";
import { ProposedSolutionBadge } from "@/features/simulator/history/ProposedSolutionBadge";

type NetworkFilter = "ALL" | "PCG" | "DES" | "Paoleschi";

export function HistoryPage() {
  const { userId } = useCurrentUser();
  const simulations = useMySimulationsWithSummary();
  const deleteSimulation = useMutation(api.simulations.deleteSimulation);
  const [search, setSearch] = useState("");
  const [networkFilter, setNetworkFilter] = useState<NetworkFilter>("ALL");

  const filtered = useMemo(() => {
    if (!simulations) return [];
    const query = search.trim().toLowerCase();
    return simulations
      .filter((item) => {
        if (networkFilter !== "ALL" && item.network !== networkFilter) {
          return false;
        }
        if (!query) return true;
        const fullName =
          `${item.patientFirstName} ${item.patientLastName}`.toLowerCase();
        return (
          item.patientFirstName.toLowerCase().includes(query) ||
          item.patientLastName.toLowerCase().includes(query) ||
          fullName.includes(query)
        );
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [simulations, search, networkFilter]);

  const handleDelete = async (simulationId: Id<"simulations">) => {
    if (!userId) return;
    try {
      await deleteSimulation({ simulationId, actorUserId: userId });
      toast.success("Simulazione eliminata");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossibile eliminare la simulazione.",
      );
    }
  };

  if (simulations === undefined) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cronologia"
        description="Simulazioni del profilo CM corrente con riepilogo confronti e proposta."
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Cerca per nome o cognome paziente"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          value={networkFilter}
          onValueChange={(value) => setNetworkFilter(value as NetworkFilter)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Rete" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutte le reti</SelectItem>
            <SelectItem value="PCG">PCG</SelectItem>
            <SelectItem value="DES">DES</SelectItem>
            <SelectItem value="Paoleschi">Paoleschi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nessuna simulazione trovata"
          description="Modifica i filtri oppure crea una nuova simulazione."
          action={
            <Button asChild>
              <Link to="/app/simulator">Nuova simulazione</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((simulation) => (
            <div
              key={simulation._id}
              className="flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">
                    {simulation.patientFirstName} {simulation.patientLastName}
                  </p>
                  <ComparisonStatusBadge
                    comparisonStatus={simulation.comparisonStatus}
                    simulationStatus={simulation.status}
                  />
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {simulation.network}
                  </span>
                  {simulation.inputsChangedAfterLatestRun ? (
                    <Badge variant="warning">Dati aggiornati</Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(simulation.requestedAmount)} · aggiornata{" "}
                  {formatDateTime(simulation.updatedAt)} ·{" "}
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
                      {simulation.proposedSolutionSummary
                        .regularTotalInstallmentAmount !== undefined
                        ? ` · ${formatCurrency(simulation.proposedSolutionSummary.regularTotalInstallmentAmount)}`
                        : ""}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/app/history/${simulation._id}`}>Apri</Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Trash2 />
                      Elimina
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Eliminare la simulazione?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        La simulazione, i confronti salvati e la soluzione
                        proposta verranno eliminati definitivamente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => void handleDelete(simulation._id)}
                      >
                        Conferma eliminazione
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
