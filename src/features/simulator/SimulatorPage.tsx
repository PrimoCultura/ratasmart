import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { NETWORKS } from "@/lib/constants/app";
import {
  COMMON_FIRST_INSTALLMENT_DELAYS,
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_TYPES,
} from "@/lib/constants/financial";
import { parseItalianAmount } from "@/lib/formatting/currency";
import {
  patientSimulationSchema,
  type PatientSimulationInput,
} from "@/lib/validation/schemas";
import { createComparisonRequestId } from "@/hooks";

type FormValues = {
  patientFirstName: string;
  patientLastName: string;
  network: PatientSimulationInput["network"];
  patientAge: string;
  employmentType: PatientSimulationInput["employmentType"] | "";
  temporaryContractExpiry: string;
  isNonEuCitizen: "yes" | "no";
  residencePermitExpiry: string;
  hasResidencePermitRenewalReceiptOnly: boolean;
  employmentSeniorityMonths: string;
  hasGuarantor: "yes" | "no" | "";
  requestedAmount: string;
  targetInstallment: string;
  requestedDurationMonths: string;
  preferredFirstInstallmentDelayDays: string;
};

function parseDateInput(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.getTime();
}

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
      hasResidencePermitRenewalReceiptOnly: false,
      employmentSeniorityMonths: "",
      hasGuarantor: "",
      requestedAmount: "",
      targetInstallment: "",
      requestedDurationMonths: "",
      preferredFirstInstallmentDelayDays: "30",
    },
  });

  const employmentType = form.watch("employmentType");
  const isNonEuCitizen = form.watch("isNonEuCitizen");
  const showContractExpiry = employmentType === "temporary_employee";
  const showPermitExpiry = isNonEuCitizen === "yes";
  const showSeniority = employmentType === "permanent_employee";
  const showGuarantor =
    employmentType === "student" || employmentType === "housewife";

  const onSubmit = form.handleSubmit(async (values) => {
    if (!userId) {
      toast.error("Profilo non selezionato.");
      return;
    }

    const requestedAmount = parseItalianAmount(values.requestedAmount);
    const targetInstallmentRaw = values.targetInstallment.trim();
    const targetInstallment = targetInstallmentRaw
      ? parseItalianAmount(targetInstallmentRaw)
      : undefined;
    const requestedDurationMonthsRaw = values.requestedDurationMonths.trim();
    const requestedDurationMonths = requestedDurationMonthsRaw
      ? Number(requestedDurationMonthsRaw)
      : undefined;
    const preferredDelayRaw = values.preferredFirstInstallmentDelayDays.trim();
    const preferredFirstInstallmentDelayDays = preferredDelayRaw
      ? Number(preferredDelayRaw)
      : undefined;

    const parsed = patientSimulationSchema.safeParse({
      patientFirstName: values.patientFirstName,
      patientLastName: values.patientLastName,
      network: values.network,
      patientAge: Number(values.patientAge),
      employmentType: values.employmentType || undefined,
      temporaryContractExpiry: parseDateInput(values.temporaryContractExpiry),
      isNonEuCitizen: values.isNonEuCitizen === "yes",
      residencePermitExpiry: parseDateInput(values.residencePermitExpiry),
      hasResidencePermitRenewalReceiptOnly:
        values.isNonEuCitizen === "yes"
          ? values.hasResidencePermitRenewalReceiptOnly
          : undefined,
      employmentSeniorityMonths:
        values.employmentType === "permanent_employee" &&
        values.employmentSeniorityMonths.trim()
          ? Number(values.employmentSeniorityMonths)
          : undefined,
      hasGuarantor:
        values.hasGuarantor === "yes"
          ? true
          : values.hasGuarantor === "no"
            ? false
            : undefined,
      requestedAmount,
      targetInstallment,
      requestedDurationMonths,
      preferredFirstInstallmentDelayDays,
    });

    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ?? "Controlla i dati inseriti.",
      );
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
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="patientFirstName">Nome</Label>
              <Input id="patientFirstName" {...form.register("patientFirstName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patientLastName">Cognome</Label>
              <Input id="patientLastName" {...form.register("patientLastName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patientAge">Età (anni compiuti)</Label>
              <Input
                id="patientAge"
                inputMode="numeric"
                {...form.register("patientAge")}
              />
            </div>
            <div className="space-y-2">
              <Label>Rete PCG/DES</Label>
              <Controller
                control={form.control}
                name="network"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona rete" />
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
              <Label>Cittadino extracomunitario</Label>
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
            {showContractExpiry ? (
              <div className="space-y-2">
                <Label htmlFor="temporaryContractExpiry">
                  Scadenza contratto determinato
                </Label>
                <Input
                  id="temporaryContractExpiry"
                  type="date"
                  {...form.register("temporaryContractExpiry")}
                />
              </div>
            ) : null}
            {showPermitExpiry ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="residencePermitExpiry">
                    Scadenza permesso di soggiorno
                  </Label>
                  <Input
                    id="residencePermitExpiry"
                    type="date"
                    {...form.register("residencePermitExpiry")}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.watch("hasResidencePermitRenewalReceiptOnly")}
                    onChange={(e) =>
                      form.setValue(
                        "hasResidencePermitRenewalReceiptOnly",
                        e.target.checked,
                      )
                    }
                  />
                  Solo ricevuta di rinnovo (senza permesso in corso di validità)
                </label>
              </>
            ) : null}
            {showSeniority ? (
              <div className="space-y-2">
                <Label htmlFor="employmentSeniorityMonths">
                  Anzianità lavorativa (mesi)
                </Label>
                <Input
                  id="employmentSeniorityMonths"
                  inputMode="numeric"
                  placeholder="es. 12"
                  {...form.register("employmentSeniorityMonths")}
                />
              </div>
            ) : null}
            {showGuarantor ? (
              <div className="space-y-2">
                <Label>Garante dichiarato</Label>
                <Controller
                  control={form.control}
                  name="hasGuarantor"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Sì</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="requestedAmount">Importo richiesto (€)</Label>
              <Input
                id="requestedAmount"
                inputMode="decimal"
                placeholder="es. 3.500,00"
                {...form.register("requestedAmount")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetInstallment">
                Rata obiettivo (€) — facoltativa
              </Label>
              <Input
                id="targetInstallment"
                inputMode="decimal"
                {...form.register("targetInstallment")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requestedDurationMonths">
                Durata desiderata (mesi) — facoltativa
              </Label>
              <Input
                id="requestedDurationMonths"
                inputMode="numeric"
                {...form.register("requestedDurationMonths")}
              />
            </div>
            <div className="space-y-2">
              <Label>Prima rata preferita — facoltativa</Label>
              <Controller
                control={form.control}
                name="preferredFirstInstallmentDelayDays"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona" />
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
            <div className="sm:col-span-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Calcolo in corso…" : "Trova le soluzioni"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
