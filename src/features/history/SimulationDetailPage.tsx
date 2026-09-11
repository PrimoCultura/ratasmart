import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import {
  ComparisonStatusBadge,
  StatusBadge,
} from "@/components/common/StatusBadge";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import {
  EMPLOYMENT_TYPE_LABELS,
} from "@/lib/constants/financial";
import { formatCurrency, formatDateTime } from "@/lib/formatting/currency";
import { ProposedSolutionBadge } from "@/features/simulator/history/ProposedSolutionBadge";
import { SimulationComparisonWorkspace } from "@/features/simulator/history/SimulationComparisonWorkspace";
import { SimulationFormFields } from "@/features/simulator/SimulationFormFields";
import {
  parseSimulationFormValues,
  SIMULATION_FORM_DEFAULT_VALUES,
  simulationToFormValues,
  type SimulationFormValues,
} from "@/features/simulator/simulationFormModel";

export function SimulationDetailPage() {
  const { simulationId } = useParams<{ simulationId: string }>();
  const { userId } = useCurrentUser();
  const [editing, setEditing] = useState(false);
  const [showPatientDetails, setShowPatientDetails] = useState(false);
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

  const form = useForm<SimulationFormValues>({
    defaultValues: SIMULATION_FORM_DEFAULT_VALUES,
  });

  useEffect(() => {
    if (!simulation) return;
    form.reset(simulationToFormValues(simulation));
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

  const employmentLabel = simulation.employmentType
    ? EMPLOYMENT_TYPE_LABELS[simulation.employmentType]
    : "—";

  const onSave = form.handleSubmit(async (values) => {
    if (!userId) return;
    const parsed = parseSimulationFormValues(values);
    if (!parsed.success) {
      toast.error(parsed.message);
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
    <div className="space-y-3">
      <PageHeader
        title={`${simulation.patientFirstName} ${simulation.patientLastName}`}
        description="Dettaglio simulazione e confronti."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/app/history">Torna alla cronologia</Link>
          </Button>
        }
      />

      <Card data-testid="simulation-summary-strip">
        <CardContent className="space-y-2 py-3">
          {!editing ? (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">
                  {simulation.patientFirstName} {simulation.patientLastName}
                </span>
                <span className="text-muted-foreground">
                  {simulation.patientAge !== undefined
                    ? `${simulation.patientAge} anni`
                    : "—"}
                </span>
                <Badge variant="outline">{simulation.network}</Badge>
                <span className="font-medium tabular-nums">
                  {formatCurrency(simulation.requestedAmount)}
                </span>
                <span className="text-muted-foreground">{employmentLabel}</span>
                <span className="text-muted-foreground">
                  {simulation.isNonEuCitizen ? "Extracomunitario" : "Italiano"}
                </span>
                {simulation.patientRequestsZeroInterest ? (
                  <Badge variant="secondary">Richiesta tasso zero</Badge>
                ) : null}
                <StatusBadge status={simulation.status} />
                <ComparisonStatusBadge
                  comparisonStatus={simulation.comparisonStatus}
                  simulationStatus={simulation.status}
                />
                {simulation.selectedSolutionLabel ? (
                  <>
                    <ProposedSolutionBadge />
                    <Badge variant="outline">
                      {simulation.selectedSolutionLabel}
                    </Badge>
                  </>
                ) : null}
              </div>
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground"
                data-testid="show-patient-details"
                aria-expanded={showPatientDetails}
                onClick={() => setShowPatientDetails((value) => !value)}
              >
                {showPatientDetails
                  ? "Nascondi dettagli paziente"
                  : "Mostra dettagli paziente"}
              </button>
              {showPatientDetails ? (
                <p className="text-xs text-muted-foreground">
                  Ultimo aggiornamento {formatDateTime(simulation.updatedAt)}
                  {simulation.employmentStartDate
                    ? ` · Assunzione ${simulation.employmentStartDate}`
                    : ""}
                  {simulation.targetInstallment !== undefined
                    ? ` · Rata obiettivo ${formatCurrency(simulation.targetInstallment)}`
                    : ""}
                  {simulation.requestedDurationMonths !== undefined
                    ? ` · Durata desiderata ${simulation.requestedDurationMonths} mesi`
                    : ""}
                </p>
              ) : null}
            </>
          ) : (
            <form onSubmit={onSave} data-testid="simulation-edit-form">
              <p className="mb-3 text-sm font-medium">Modifica dati simulazione</p>
              <SimulationFormFields
                form={form}
                idPrefix="edit"
                submitLabel={isSaving ? "Salvataggio…" : "Salva dati"}
                isSubmitting={isSaving}
                onCancel={() => {
                  form.reset(simulationToFormValues(simulation));
                  setEditing(false);
                }}
              />
            </form>
          )}
        </CardContent>
      </Card>

      <SimulationComparisonWorkspace
        simulation={simulation}
        onEditData={() => {
          form.reset(simulationToFormValues(simulation));
          setEditing(true);
        }}
      />
    </div>
  );
}
