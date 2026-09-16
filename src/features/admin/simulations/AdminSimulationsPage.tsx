import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { formatCurrency, formatDateTime } from "@/lib/formatting/currency";
import {
  SIMULATION_DELETION_REASON_LABELS,
  type SimulationDeletionReason,
} from "../../../../shared/admin-analytics";

const PERIOD_OPTIONS = [
  { value: "30", label: "Ultimi 30 giorni" },
  { value: "90", label: "Ultimi 90 giorni" },
  { value: "365", label: "Ultimi 12 mesi" },
  { value: "all", label: "Tutto" },
] as const;

export function AdminSimulationsPage() {
  const { userId } = useCurrentUser();
  const [period, setPeriod] = useState("30");
  const [network, setNetwork] = useState<"ALL" | "PCG" | "DES" | "Paoleschi">(
    "ALL",
  );
  const [clinicName, setClinicName] = useState("ALL");
  const [ownerUserId, setOwnerUserId] = useState<string>("ALL");
  const [outcome, setOutcome] = useState<
    "ALL" | "compatible" | "verification_required" | "no_solution" | "no_comparison"
  >("ALL");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Id<"simulations"> | null>(
    null,
  );
  const [deletionReason, setDeletionReason] =
    useState<SimulationDeletionReason>("data_entry_error");
  const [deletionNotes, setDeletionNotes] = useState("");

  // Stabilizza gli argomenti Convex (evita Date.now() a ogni render).
  const periodRange = useMemo(() => {
    if (period === "all") {
      return { fromMs: undefined as number | undefined, toMs: undefined as number | undefined };
    }
    const toMs = Date.now();
    return {
      toMs,
      fromMs: toMs - Number(period) * 24 * 60 * 60 * 1000,
    };
  }, [period]);

  const filterOptions = useQuery(
    api.adminAnalytics.listFilterOptions,
    userId ? { actorUserId: userId } : "skip",
  );
  const rows = useQuery(
    api.adminAnalytics.listAdminSimulationsGovernance,
    userId
      ? {
          actorUserId: userId,
          fromMs: periodRange.fromMs,
          toMs: periodRange.toMs,
          network: network === "ALL" ? undefined : network,
          clinicName: clinicName === "ALL" ? undefined : clinicName,
          ownerUserId:
            ownerUserId === "ALL"
              ? undefined
              : (ownerUserId as Id<"appUsers">),
          includeDeleted,
          outcome: outcome === "ALL" ? undefined : outcome,
        }
      : "skip",
  );

  const softDelete = useMutation(api.adminGovernance.softDeleteSimulation);
  const restore = useMutation(api.adminGovernance.restoreSimulation);

  const clinics = useMemo(
    () => filterOptions?.clinics ?? [],
    [filterOptions],
  );
  const cms = useMemo(() => filterOptions?.users ?? [], [filterOptions]);

  if (!userId) {
    return <LoadingState />;
  }

  if (rows === undefined || filterOptions === undefined) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulazioni"
        description="Governance operativa: dettaglio, soft-delete e ripristino. Separata dagli analytics aggregati."
      />

      <div className="flex flex-wrap gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={network}
          onValueChange={(value) => setNetwork(value as typeof network)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutte le reti</SelectItem>
            <SelectItem value="PCG">PCG</SelectItem>
            <SelectItem value="DES">DES</SelectItem>
            <SelectItem value="Paoleschi">Paoleschi</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clinicName} onValueChange={setClinicName}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Clinica" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutte le cliniche</SelectItem>
            {clinics.map((clinic) => (
              <SelectItem key={clinic} value={clinic}>
                {clinic}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ownerUserId} onValueChange={setOwnerUserId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Utente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutti gli utenti</SelectItem>
            {cms.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={outcome}
          onValueChange={(value) => setOutcome(value as typeof outcome)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutti gli esiti</SelectItem>
            <SelectItem value="compatible">Compatible</SelectItem>
            <SelectItem value="verification_required">Verification</SelectItem>
            <SelectItem value="no_solution">No solution</SelectItem>
            <SelectItem value="no_comparison">Senza confronto</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(event) => setIncludeDeleted(event.target.checked)}
          />
          Mostra eliminate
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nessuna simulazione"
          description="Nessun risultato per i filtri selezionati."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row._id}
              className="flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{row.patientLabel}</p>
                  <Badge variant="outline">{row.network}</Badge>
                  <Badge variant="secondary">{row.outcome}</Badge>
                  {row.isDeleted ? (
                    <Badge variant="warning">Eliminata</Badge>
                  ) : (
                    <Badge variant="outline">Attiva</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(row.createdAt)} · {row.ownerDisplayName}
                  {row.clinicName ? ` · ${row.clinicName}` : ""} ·{" "}
                  {row.requestedAmount !== undefined
                    ? formatCurrency(row.requestedAmount)
                    : "importo n/d"}{" "}
                  · durata{" "}
                  {row.selectedDurationMonths ??
                    row.requestedDurationMonths ??
                    "n/d"}{" "}
                  · compatibili {row.compatibleSolutionsCount} · verification{" "}
                  {row.verificationRequiredSolutionsCount}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/admin/simulazioni/${row._id}`}>Apri</Link>
                </Button>
                {row.isDeleted ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      if (!userId) return;
                      try {
                        await restore({
                          actorUserId: userId,
                          simulationId: row._id,
                        });
                        toast.success("Simulazione ripristinata");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Ripristino non riuscito",
                        );
                      }
                    }}
                  >
                    Ripristina
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setDeletionReason("data_entry_error");
                      setDeletionNotes("");
                      setDeleteTarget(row._id);
                    }}
                  >
                    Elimina
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Motivo della cancellazione</AlertDialogTitle>
            <AlertDialogDescription>
              Soft-delete: la simulazione sparisce da cronologia e analytics, ma
              resta recuperabile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select
                value={deletionReason}
                onValueChange={(value) =>
                  setDeletionReason(value as SimulationDeletionReason)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(
                      SIMULATION_DELETION_REASON_LABELS,
                    ) as SimulationDeletionReason[]
                  ).map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {SIMULATION_DELETION_REASON_LABELS[reason]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Note (opzionale)</Label>
              <Textarea
                value={deletionNotes}
                onChange={(event) => setDeletionNotes(event.target.value)}
                rows={3}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!userId || !deleteTarget) return;
                try {
                  await softDelete({
                    actorUserId: userId,
                    simulationId: deleteTarget,
                    deletionReason,
                    deletionNotes: deletionNotes.trim() || undefined,
                  });
                  toast.success("Simulazione eliminata (soft-delete)");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Eliminazione non riuscita",
                  );
                } finally {
                  setDeleteTarget(null);
                }
              }}
            >
              Conferma eliminazione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
