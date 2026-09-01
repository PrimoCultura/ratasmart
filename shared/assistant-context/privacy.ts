import type { ChatPrivacyMode } from "./types.ts";

export function isPatientSafe(mode: ChatPrivacyMode): boolean {
  return mode === "patient_safe";
}

export function assertNoPatientIdentifiers(text: string): string[] {
  const forbidden = [
    "patientFirstName",
    "patientLastName",
    "clinicName",
    "firstName",
    "lastName",
    "codice fiscale",
    "codicefiscale",
  ];
  const lower = text.toLowerCase();
  return forbidden.filter((token) => lower.includes(token.toLowerCase()));
}

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  permanent_employee: "Dipendente a tempo indeterminato",
  temporary_employee: "Dipendente a tempo determinato",
  pensioner: "Pensionato",
  self_employed: "Autonomo",
  unemployed: "Disoccupato",
  other: "Altro",
};
