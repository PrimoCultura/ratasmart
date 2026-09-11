import { Controller, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NETWORKS } from "@/lib/constants/app";
import {
  COMMON_FIRST_INSTALLMENT_DELAYS,
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_TYPES,
} from "@/lib/constants/financial";
import {
  getSimulationFormVisibility,
  type SimulationFormValues,
} from "./simulationFormModel";

type SimulationFormFieldsProps = {
  form: UseFormReturn<SimulationFormValues>;
  submitLabel: string;
  isSubmitting?: boolean;
  onCancel?: () => void;
  idPrefix?: string;
};

export function SimulationFormFields({
  form,
  submitLabel,
  isSubmitting = false,
  onCancel,
  idPrefix = "",
}: SimulationFormFieldsProps) {
  const values = form.watch();
  const {
    showContractExpiry,
    showPermitExpiry,
    showEmploymentStart,
    showGuarantor,
  } = getSimulationFormVisibility(values);

  const id = (name: string) => (idPrefix ? `${idPrefix}-${name}` : name);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={id("patientFirstName")}>Nome</Label>
        <Input
          id={id("patientFirstName")}
          {...form.register("patientFirstName")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("patientLastName")}>Cognome</Label>
        <Input
          id={id("patientLastName")}
          {...form.register("patientLastName")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("patientAge")}>Età (anni compiuti)</Label>
        <Input
          id={id("patientAge")}
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
          <Label htmlFor={id("temporaryContractExpiry")}>
            Scadenza contratto determinato
          </Label>
          <Input
            id={id("temporaryContractExpiry")}
            type="date"
            {...form.register("temporaryContractExpiry")}
          />
        </div>
      ) : null}
      {showPermitExpiry ? (
        <>
          <div className="space-y-2">
            <Label htmlFor={id("residencePermitExpiry")}>
              Scadenza permesso di soggiorno
            </Label>
            <Input
              id={id("residencePermitExpiry")}
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
      {showEmploymentStart ? (
        <div className="space-y-2">
          <Label htmlFor={id("employmentStartDate")}>Data di assunzione</Label>
          <Input
            id={id("employmentStartDate")}
            type="date"
            {...form.register("employmentStartDate")}
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
        <Label htmlFor={id("requestedAmount")}>Importo richiesto (€)</Label>
        <Input
          id={id("requestedAmount")}
          inputMode="decimal"
          placeholder="es. 3.500,00"
          {...form.register("requestedAmount")}
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={form.watch("patientRequestsZeroInterest")}
          onChange={(e) =>
            form.setValue("patientRequestsZeroInterest", e.target.checked)
          }
        />
        <span>Il paziente richiede espressamente il tasso zero</span>
      </label>
      <div className="space-y-2">
        <Label htmlFor={id("targetInstallment")}>
          Rata obiettivo (€) — facoltativa
        </Label>
        <Input
          id={id("targetInstallment")}
          inputMode="decimal"
          {...form.register("targetInstallment")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("requestedDurationMonths")}>
          Durata desiderata (mesi) — facoltativa
        </Label>
        <Input
          id={id("requestedDurationMonths")}
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
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvataggio…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annulla
          </Button>
        ) : null}
      </div>
    </div>
  );
}
