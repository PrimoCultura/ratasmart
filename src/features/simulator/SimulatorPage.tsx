import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { createComparisonRequestId } from "@/hooks";
import { SimulationFormFields } from "./SimulationFormFields";
import {
  parseSimulationFormValues,
  SIMULATION_FORM_DEFAULT_VALUES,
  type SimulationFormValues,
} from "./simulationFormModel";

export function SimulatorPage() {
  const navigate = useNavigate();
  const { userId } = useCurrentUser();
  const savePatientData = useMutation(
    api.simulations.updateSimulationPatientData,
  );
  const calculateComparison = useAction(
    api.comparison.calculateSimulationComparison,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SimulationFormValues>({
    defaultValues: SIMULATION_FORM_DEFAULT_VALUES,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!userId) {
      toast.error("Profilo non selezionato.");
      return;
    }

    const parsed = parseSimulationFormValues(values);
    if (!parsed.success) {
      toast.error(parsed.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const simulationId = await savePatientData({
        actorUserId: userId,
        ...parsed.data,
      });
      await calculateComparison({
        currentUserId: userId,
        simulationId,
        requestId: createComparisonRequestId(),
        source: "initial_calculation",
      });
      toast.success("Confronto calcolato e salvato");
      navigate(`/app/history/${simulationId}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossibile calcolare il confronto.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuova simulazione"
        description="Inserisci i dati minimi del paziente. Il confronto verrà salvato come snapshot immutabile."
      />

      <Card>
        <CardHeader>
          <CardTitle>Dati paziente e richiesta</CardTitle>
          <CardDescription>
            Dopo il calcolo potrai consultare la cronologia confronti e
            selezionare la soluzione proposta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <SimulationFormFields
              form={form}
              submitLabel={
                isSubmitting ? "Calcolo in corso…" : "Trova le soluzioni"
              }
              isSubmitting={isSubmitting}
            />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
