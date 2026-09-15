import { v } from "convex/values";

/**
 * Contratto unico patientSnapshot per schema DB e mutation di persistenza.
 * birthDate / ageAtReferenceDate optional → snapshot legacy accettati.
 */
export const employmentTypeSnapshotValidator = v.union(
  v.literal("permanent_employee"),
  v.literal("temporary_employee"),
  v.literal("pensioner"),
  v.literal("self_employed"),
  v.literal("unemployed"),
  v.literal("student"),
  v.literal("housewife"),
  v.literal("other"),
);

export const patientSnapshotValidator = v.object({
  firstName: v.string(),
  lastName: v.string(),
  age: v.number(),
  birthDate: v.optional(v.string()),
  ageAtReferenceDate: v.optional(v.number()),
  employmentType: employmentTypeSnapshotValidator,
  temporaryContractExpiry: v.optional(v.number()),
  isNonEuCitizen: v.boolean(),
  residencePermitExpiry: v.optional(v.number()),
  hasResidencePermitRenewalReceiptOnly: v.optional(v.boolean()),
  employmentStartDate: v.optional(v.string()),
  employmentSeniorityMonths: v.optional(v.number()),
  seniorityReferenceDate: v.optional(v.number()),
  hasGuarantor: v.optional(v.boolean()),
  patientRequestsZeroInterest: v.optional(v.boolean()),
});

/** Chiavi ammesse (allineate al validator e a PatientSnapshot TS). */
export const PATIENT_SNAPSHOT_ALLOWED_KEYS = [
  "firstName",
  "lastName",
  "age",
  "birthDate",
  "ageAtReferenceDate",
  "employmentType",
  "temporaryContractExpiry",
  "isNonEuCitizen",
  "residencePermitExpiry",
  "hasResidencePermitRenewalReceiptOnly",
  "employmentStartDate",
  "employmentSeniorityMonths",
  "seniorityReferenceDate",
  "hasGuarantor",
  "patientRequestsZeroInterest",
] as const;

const ALLOWED_SET = new Set<string>(PATIENT_SNAPSHOT_ALLOWED_KEYS);

/**
 * Validazione strutturale leggera (senza runtime Convex) per test e guardrail.
 * Specchio del comportamento "extra field" dei validator Convex.
 */
export function acceptPatientSnapshotShape(
  snapshot: Record<string, unknown>,
): { ok: true } | { ok: false; reason: string } {
  for (const key of Object.keys(snapshot)) {
    if (!ALLOWED_SET.has(key)) {
      return {
        ok: false,
        reason: `Object contains extra field \`${key}\` that is not in the validator.`,
      };
    }
  }

  if (typeof snapshot.firstName !== "string" || !snapshot.firstName) {
    return { ok: false, reason: "firstName required" };
  }
  if (typeof snapshot.lastName !== "string" || !snapshot.lastName) {
    return { ok: false, reason: "lastName required" };
  }
  if (typeof snapshot.age !== "number" || !Number.isFinite(snapshot.age)) {
    return { ok: false, reason: "age required" };
  }
  if (typeof snapshot.isNonEuCitizen !== "boolean") {
    return { ok: false, reason: "isNonEuCitizen required" };
  }
  if (typeof snapshot.employmentType !== "string") {
    return { ok: false, reason: "employmentType required" };
  }
  if (
    snapshot.birthDate !== undefined &&
    typeof snapshot.birthDate !== "string"
  ) {
    return { ok: false, reason: "birthDate must be string when present" };
  }
  if (
    snapshot.ageAtReferenceDate !== undefined &&
    typeof snapshot.ageAtReferenceDate !== "number"
  ) {
    return {
      ok: false,
      reason: "ageAtReferenceDate must be number when present",
    };
  }

  return { ok: true };
}
