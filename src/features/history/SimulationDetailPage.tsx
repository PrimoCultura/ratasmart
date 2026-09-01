import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import {
  ComparisonStatusBadge,
  StatusBadge,
} from "@/components/common/StatusBadge";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { NETWORKS } from "@/lib/constants/app";
import {
  COMMON_FIRST_INSTALLMENT_DELAYS,
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_TYPES,
  type EmploymentType,
} from "@/lib/constants/financial";
import {
  formatCurrency,
  formatDateTime,
  parseItalianAmount,
} from "@/lib/formatting/currency";
import { patientSimulationSchema } from "@/lib/validation/schemas";
import { ProposedSolutionBadge } from "@/features/simulator/history/ProposedSolutionBadge";
import { SimulationComparisonWorkspace } from "@/features/simulator/history/SimulationComparisonWorkspace";

type FormValues = {
  patientFirstName: string;
  patientLastName: string;
  network: "PCG" | "DES";
  patientAge: string;
  employmentType: EmploymentType | "";
  temporaryContractExpiry: string;
  isNonEuCitizen: "yes" | "no";
  residencePermitExpiry: string;
  requestedAmount: string;
  targetInstallment: string;
  requestedDurationMonths: string;
  preferredFirstInstallmentDelayDays: string;
};

function toDateInput(value?: number): string {
  if (!value) return "";
  const date = new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateInput(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.getTime();
}

function formatAmountInput(value?: number): string {
  if (value === undefined) return "";
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SimulationDetailPage() {
  const { simulationId } = useParams<{ simulationId: string }>();
  const { userId } = useCurrentUser();
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savePatientData = useMutation(
    api.simulations.updateSimulationPatientData,
  );

  const simulation = useQuery(
    api.simulations.getSimulation,
    userId && simulationId
      ? {
          simulationId: simulationId as Id<"simulations">,
          actorUserId: userId,
        }
      : "skip",
  );

  const form = useForm<FormValues>({
    defaultValues: {
      patientFirstName: "",
      patientLastName: "",
      network: "PCG",
      patientAge: "",
      employmentType: "",
      temporaryContractExpiry: "",
      isNonEuCitizen: "no",
      residencePermitExpiry: "",
      requestedAmount: "",
      targetInstallment: "",
      requestedDurationMonths: "",
      preferredFirstInstallmentDelayDays: "30",
    },
  });

  useEffect(() => {
    if (!simulation) return;
    form.reset({
      patientFirstName: simulation.patientFirstName,
      patientLastName: simulation.patientLastName,
      network: simulation.network,
      patientAge:
        simulation.patientAge !== undefined
          ? String(simulation.patientAge)
          : "",
      employmentType: simulation.employmentType ?? "",
      temporaryContractExpiry: toDateInput(simulation.temporaryContractExpiry),
      isNonEuCitizen: simulation.isNonEuCitizen ? "yes" : "no",
      residencePermitExpiry: toDateInput(simulation.residencePermitExpiry),
      requestedAmount: formatAmountInput(simulation.requestedAmount),
      targetInstallment: formatAmountInput(simulation.targetInstallment),
      requestedDurationMonths:
        simulation.requestedDurationMonths !== undefined
          ? String(simulation.requestedDurationMonths)
          : "",
      preferredFirstInstallmentDelayDays: String(
        simulation.preferredFirstInstallmentDelayDays ?? 30,
      ),
    });
  }, [simulation, form]);

  if (simulation === undefined) {
    return <LoadingState />;
  }

  if (simulation === null) {
    return (
      <ErrorState
        title="Simulazione non trovata"
        message="La simulazione richiesta non esiste oppure non è più disponibile."
      />
    );
  }

  const employmentType = form.watch("employmentType");
  const isNonEuCitizen = form.watch("isNonEuCitizen");

  const onSave = form.handleSubmit(async (values) => {
    if (!userId) return;
    const parsed = patientSimulationSchema.safeParse({
      patientFirstName: values.patientFirstName,
      patientLastName: values.patientLastName,
      network: values.network,
      patientAge: Number(values.patientAge),
      employmentType: values.employmentType || undefined,
      temporaryContractExpiry: parseDateInput(values.temporaryContractExpiry),
      isNonEuCitizen: values.isNonEuCitizen === "yes",
      residencePermitExpiry: parseDateInput(values.residencePermitExpiry),
      requestedAmount: parseItalianAmount(values.requestedAmount),
      targetInstallment: values.targetInstallment.trim()
        ? parseItalianAmount(values.targetInstallment)
        : undefined,
      requestedDurationMonths: values.requestedDurationMonths.trim()
        ? Number(values.requestedDurationMonths)
        : undefined,
      preferredFirstInstallmentDelayDays: values.preferredFirstInstallmentDelayDays
        ? Number(values.preferredFirstInstallmentDelayDays)
        : undefined,
    });
    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ?? "Controlla i dati inseriti.",
      );
      return;
    }
    setIsSaving(true);
    try {
      await savePatientData({
        simulationId: simulation._id,
        actorUserId: userId,
        ...parsed.data,
      });
      toast.success("Dati aggiornati");
      setEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Salvataggio non riuscito.",
      );
    } finally {
      setIsSaving(false);
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${simulation.patientFirstName} ${simulation.patientLastName}`}
        description="Dettaglio simulazione, confronti salvati e soluzione proposta."
        actions={
          <Button asChild variant="outline">
            <Link to="/app/history">Torna alla cronologia</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Dati simulazione</CardTitle>
            <StatusBadge status={simulation.status} />
            <ComparisonStatusBadge
              comparisonStatus={simulation.comparisonStatus}
              simulationStatus={simulation.status}
            />
            {simulation.selectedSolutionLabel ? (
              <>
                <ProposedSolutionBadge />
                <Badge variant="outline">{simulation.selectedSolutionLabel}</Badge>
              </>
            ) : null}
          </div>
          {!editing ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              Modifica dati
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {!editing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Rete" value={simulation.network} />
              <DetailItem
                label="Importo richiesto"
                value={formatCurrency(simulation.requestedAmount)}
              />
              <DetailItem
                label="Età"
                value={
                  simulation.patientAge !== undefined
                    ? `${simulation.patientAge} anni`
                    : "—"
                }
              />
              <DetailItem
                label="Ultimo aggiornamento"
                value={formatDateTime(simulation.updatedAt)}
              />
            </div>
          ) : (
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSave}>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input {...form.register("patientFirstName")} />
              </div>
              <div className="space-y-2">
                <Label>Cognome</Label>
                <Input {...form.register("patientLastName")} />
              </div>
              <div className="space-y-2">
                <Label>Età</Label>
                <Input inputMode="numeric" {...form.register("patientAge")} />
              </div>
              <div className="space-y-2">
                <Label>Rete</Label>
                <Controller
                  control={form.control}
                  name="network"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NETWORKS.map((network) => (
                          <SelectItem key={network} value={network}>
                            {network}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Condizione lavorativa</Label>
                <Controller
                  control={form.control}
                  name="employmentType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona" />
                      </SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {EMPLOYMENT_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Extracomunitario</Label>
                <Controller
                  control={form.control}
                  name="isNonEuCitizen"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange as (value: string) => void}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Sì</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {employmentType === "temporary_employee" ? (
                <div className="space-y-2">
                  <Label>Scadenza contratto</Label>
                  <Input type="date" {...form.register("temporaryContractExpiry")} />
                </div>
              ) : null}
              {isNonEuCitizen === "yes" ? (
                <div className="space-y-2">
                  <Label>Scadenza permesso</Label>
                  <Input type="date" {...form.register("residencePermitExpiry")} />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Importo richiesto (€)</Label>
                <Input {...form.register("requestedAmount")} />
              </div>
              <div className="space-y-2">
                <Label>Rata obiettivo (€)</Label>
                <Input {...form.register("targetInstallment")} />
              </div>
              <div className="space-y-2">
                <Label>Durata desiderata</Label>
                <Input {...form.register("requestedDurationMonths")} />
              </div>
              <div className="space-y-2">
                <Label>Prima rata</Label>
                <Controller
                  control={form.control}
                  name="preferredFirstInstallmentDelayDays"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_FIRST_INSTALLMENT_DELAYS.map((days) => (
                          <SelectItem key={days} value={String(days)}>
                            {days} giorni
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Salvataggio…" : "Salva dati"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(false)}
                >
                  Annulla
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <SimulationComparisonWorkspace
        simulation={simulation}
        onEditData={() => setEditing(true)}
      />
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
