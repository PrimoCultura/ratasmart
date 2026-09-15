import { describe, expect, it } from "vitest";
import {
  acceptPatientSnapshotShape,
  PATIENT_SNAPSHOT_ALLOWED_KEYS,
  patientSnapshotValidator,
} from "../../../convex/lib/patientSnapshotValidator.ts";
import type { PatientSnapshot } from "../types.ts";

describe("patientSnapshot validator contract", () => {
  it("validator Convex espone birthDate e ageAtReferenceDate come optional", () => {
    const fields = patientSnapshotValidator.fields;
    expect(fields.birthDate?.isOptional).toBe("optional");
    expect(fields.ageAtReferenceDate?.isOptional).toBe("optional");
    expect(fields.age?.isOptional).toBe("required");
    expect(Object.keys(fields).sort()).toEqual(
      [...PATIENT_SNAPSHOT_ALLOWED_KEYS].sort(),
    );
  });

  it("A) snapshot legacy (solo age) → accettato", () => {
    const legacy: PatientSnapshot = {
      firstName: "Anna",
      lastName: "Bianchi",
      age: 32,
      employmentType: "permanent_employee",
      isNonEuCitizen: false,
    };
    expect(acceptPatientSnapshotShape(legacy)).toEqual({ ok: true });
    expect(legacy.birthDate).toBeUndefined();
    expect(legacy.ageAtReferenceDate).toBeUndefined();
  });

  it("B) snapshot nuovo con birthDate + ageAtReferenceDate → accettato", () => {
    const next: PatientSnapshot = {
      firstName: "Luca",
      lastName: "Verdi",
      age: 32,
      birthDate: "1994-06-23",
      ageAtReferenceDate: 32,
      employmentType: "permanent_employee",
      isNonEuCitizen: false,
    };
    expect(acceptPatientSnapshotShape(next)).toEqual({ ok: true });
  });

  it("C) snapshot nuovo completo (seniority + zero interest) → accettato", () => {
    const full: PatientSnapshot = {
      firstName: "Mario",
      lastName: "Rossi",
      age: 45,
      birthDate: "1981-03-10",
      ageAtReferenceDate: 45,
      employmentType: "permanent_employee",
      isNonEuCitizen: false,
      employmentStartDate: "2018-05-01",
      employmentSeniorityMonths: 100,
      seniorityReferenceDate: Date.UTC(2026, 8, 14),
      patientRequestsZeroInterest: true,
      hasGuarantor: false,
    };
    expect(acceptPatientSnapshotShape(full)).toEqual({ ok: true });
  });

  it("D) history/detail: nuovo snapshot non genera extra-field error", () => {
    const persistedLike = {
      firstName: "Sara",
      lastName: "Neri",
      age: 28,
      birthDate: "1998-01-15",
      ageAtReferenceDate: 28,
      employmentType: "temporary_employee",
      isNonEuCitizen: true,
      residencePermitExpiry: Date.UTC(2027, 0, 1),
      temporaryContractExpiry: Date.UTC(2027, 5, 1),
      employmentStartDate: "2024-01-01",
      employmentSeniorityMonths: 32,
      seniorityReferenceDate: Date.UTC(2026, 8, 14),
      hasResidencePermitRenewalReceiptOnly: false,
      patientRequestsZeroInterest: false,
    };
    const result = acceptPatientSnapshotShape(persistedLike);
    expect(result.ok).toBe(true);
    // Stesso messaggio che Convex emetteva prima del fix
    expect(result).not.toEqual(
      expect.objectContaining({
        reason: expect.stringContaining("ageAtReferenceDate"),
      }),
    );
  });

  it("campo sconosciuto continua a essere rifiutato", () => {
    const bad = {
      firstName: "X",
      lastName: "Y",
      age: 40,
      employmentType: "pensioner",
      isNonEuCitizen: false,
      inventedField: true,
    };
    const result = acceptPatientSnapshotShape(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("inventedField");
  });
});
