import type { Doc } from "../../../convex/_generated/dataModel";
import { parseItalianAmount } from "@/lib/formatting/currency";
import {
  patientSimulationSchema,
  type PatientSimulationInput,
} from "@/lib/validation/schemas";
import { calculateEmploymentSeniorityMonths } from "../../../shared/policy-engine/employment-seniority";

export type SimulationFormValues = {
  patientFirstName: string;
  patientLastName: string;
  network: PatientSimulationInput["network"];
  patientAge: string;
  employmentType: PatientSimulationInput["employmentType"] | "";
  temporaryContractExpiry: string;
  isNonEuCitizen: "yes" | "no";
  residencePermitExpiry: string;
  hasResidencePermitRenewalReceiptOnly: boolean;
  employmentStartDate: string;
  hasGuarantor: "yes" | "no" | "";
  patientRequestsZeroInterest: boolean;
  requestedAmount: string;
  targetInstallment: string;
  requestedDurationMonths: string;
  preferredFirstInstallmentDelayDays: string;
};

export const SIMULATION_FORM_DEFAULT_VALUES: SimulationFormValues = {
  patientFirstName: "",
  patientLastName: "",
  network: "PCG",
  patientAge: "",
  employmentType: "",
  temporaryContractExpiry: "",
  isNonEuCitizen: "no",
  residencePermitExpiry: "",
  hasResidencePermitRenewalReceiptOnly: false,
  employmentStartDate: "",
  hasGuarantor: "",
  patientRequestsZeroInterest: false,
  requestedAmount: "",
  targetInstallment: "",
  requestedDurationMonths: "",
  preferredFirstInstallmentDelayDays: "30",
};

export function parseDateInputToMs(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.getTime();
}

export function msToDateInput(value?: number): string {
  if (!value) return "";
  const date = new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatAmountInput(value?: number): string {
  if (value === undefined) return "";
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function simulationToFormValues(
  simulation: Doc<"simulations">,
): SimulationFormValues {
  return {
    patientFirstName: simulation.patientFirstName,
    patientLastName: simulation.patientLastName,
    network: simulation.network,
    patientAge:
      simulation.patientAge !== undefined ? String(simulation.patientAge) : "",
    employmentType: simulation.employmentType ?? "",
    temporaryContractExpiry: msToDateInput(simulation.temporaryContractExpiry),
    isNonEuCitizen: simulation.isNonEuCitizen ? "yes" : "no",
    residencePermitExpiry: msToDateInput(simulation.residencePermitExpiry),
    hasResidencePermitRenewalReceiptOnly:
      simulation.hasResidencePermitRenewalReceiptOnly === true,
    employmentStartDate: simulation.employmentStartDate ?? "",
    hasGuarantor:
      simulation.hasGuarantor === true
        ? "yes"
        : simulation.hasGuarantor === false
          ? "no"
          : "",
    patientRequestsZeroInterest:
      simulation.patientRequestsZeroInterest === true,
    requestedAmount: formatAmountInput(simulation.requestedAmount),
    targetInstallment: formatAmountInput(simulation.targetInstallment),
    requestedDurationMonths:
      simulation.requestedDurationMonths !== undefined
        ? String(simulation.requestedDurationMonths)
        : "",
    preferredFirstInstallmentDelayDays: String(
      simulation.preferredFirstInstallmentDelayDays ?? 30,
    ),
  };
}

export function getSimulationFormVisibility(values: SimulationFormValues) {
  const employmentType = values.employmentType;
  const isNonEuCitizen = values.isNonEuCitizen === "yes";
  return {
    showContractExpiry: employmentType === "temporary_employee",
    showPermitExpiry: isNonEuCitizen,
    showEmploymentStart:
      employmentType === "permanent_employee" ||
      employmentType === "temporary_employee",
    showGuarantor:
      employmentType === "student" || employmentType === "housewife",
  };
}

/**
 * Converte i valori UI nel payload validato per Convex.
 * Stessa logica per creazione e modifica.
 */
export function parseSimulationFormValues(
  values: SimulationFormValues,
  referenceDate: number = Date.now(),
):
  | { success: true; data: PatientSimulationInput }
  | { success: false; message: string } {
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

  const storesEmploymentStart =
    values.employmentType === "permanent_employee" ||
    values.employmentType === "temporary_employee";

  const employmentStartDate =
    storesEmploymentStart && values.employmentStartDate.trim()
      ? values.employmentStartDate.trim()
      : undefined;

  const parsed = patientSimulationSchema.safeParse({
    patientFirstName: values.patientFirstName,
    patientLastName: values.patientLastName,
    network: values.network,
    patientAge: Number(values.patientAge),
    employmentType: values.employmentType || undefined,
    temporaryContractExpiry: parseDateInputToMs(values.temporaryContractExpiry),
    isNonEuCitizen: values.isNonEuCitizen === "yes",
    residencePermitExpiry: parseDateInputToMs(values.residencePermitExpiry),
    hasResidencePermitRenewalReceiptOnly:
      values.isNonEuCitizen === "yes"
        ? values.hasResidencePermitRenewalReceiptOnly
        : undefined,
    employmentStartDate,
    employmentSeniorityMonths:
      employmentStartDate !== undefined
        ? calculateEmploymentSeniorityMonths({
            employmentStartDate,
            referenceDate,
          })
        : undefined,
    hasGuarantor:
      values.hasGuarantor === "yes"
        ? true
        : values.hasGuarantor === "no"
          ? false
          : undefined,
    patientRequestsZeroInterest: values.patientRequestsZeroInterest,
    requestedAmount,
    targetInstallment,
    requestedDurationMonths,
    preferredFirstInstallmentDelayDays,
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Controlla i dati inseriti.",
    };
  }

  return { success: true, data: parsed.data };
}

/**
 * Helper testabile: applica un update patient sul documento simulazione
 * senza azzerare campi non presenti quando non applicabile.
 */
export function mergeSimulationPatientUpdate(input: {
  existing: Partial<{
    employmentStartDate?: string;
    employmentSeniorityMonths?: number;
    temporaryContractExpiry?: number;
    residencePermitExpiry?: number;
    hasResidencePermitRenewalReceiptOnly?: boolean;
    hasGuarantor?: boolean;
    patientRequestsZeroInterest?: boolean;
    targetInstallment?: number;
    requestedDurationMonths?: number;
    preferredFirstInstallmentDelayDays?: 30 | 60 | 90;
  }>;
  update: PatientSimulationInput;
}): PatientSimulationInput & {
  employmentStartDate?: string;
  employmentSeniorityMonths?: number;
} {
  const storesEmploymentStart =
    input.update.employmentType === "permanent_employee" ||
    input.update.employmentType === "temporary_employee";

  return {
    ...input.update,
    employmentStartDate: storesEmploymentStart
      ? (input.update.employmentStartDate ?? input.existing.employmentStartDate)
      : undefined,
    employmentSeniorityMonths: storesEmploymentStart
      ? (input.update.employmentSeniorityMonths ??
        input.existing.employmentSeniorityMonths)
      : undefined,
    temporaryContractExpiry:
      input.update.employmentType === "temporary_employee"
        ? (input.update.temporaryContractExpiry ??
          input.existing.temporaryContractExpiry)
        : undefined,
    residencePermitExpiry: input.update.isNonEuCitizen
      ? (input.update.residencePermitExpiry ??
        input.existing.residencePermitExpiry)
      : undefined,
    hasResidencePermitRenewalReceiptOnly: input.update.isNonEuCitizen
      ? (input.update.hasResidencePermitRenewalReceiptOnly ??
        input.existing.hasResidencePermitRenewalReceiptOnly)
      : undefined,
    hasGuarantor: input.update.hasGuarantor ?? input.existing.hasGuarantor,
    patientRequestsZeroInterest:
      input.update.patientRequestsZeroInterest ??
      input.existing.patientRequestsZeroInterest ??
      false,
  };
}
