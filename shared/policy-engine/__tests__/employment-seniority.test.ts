import { describe, expect, it } from "vitest";
import {
  calculateEmploymentSeniorityMonths,
  resolveEmploymentSeniorityMonths,
} from "../employment-seniority.ts";
import { evaluatePolicyRule } from "../rule-evaluators.ts";
import type { RuntimePolicyRule } from "../types.ts";

const seniorityRule: RuntimePolicyRule = {
  id: "sen-1",
  policySetId: "set",
  scope: "company",
  ruleType: "minimum_employment_seniority_months",
  operator: "greater_than_or_equal",
  numericValue: 12,
  failureMessage:
    "L’anzianità lavorativa indicata è inferiore ai 12 mesi previsti dalle indicazioni operative: verificare con la finanziaria.",
  verificationMessage:
    "L’anzianità lavorativa indicata è inferiore ai 12 mesi previsti dalle indicazioni operative: verificare con la finanziaria.",
  sortOrder: 1,
};

describe("employment seniority helper", () => {
  it("calcola mesi di calendario da data assunzione e referenceDate", () => {
    const months = calculateEmploymentSeniorityMonths({
      employmentStartDate: "2025-03-11",
      referenceDate: new Date(2026, 8, 11).getTime(),
    });
    expect(months).toBe(18);
  });

  it("preferisce employmentStartDate ai mesi legacy", () => {
    const months = resolveEmploymentSeniorityMonths({
      employmentStartDate: "2026-03-11",
      employmentSeniorityMonths: 99,
      referenceDate: new Date(2026, 8, 11).getTime(),
    });
    expect(months).toBe(6);
  });
});

describe("seniority policy – missing vs under threshold", () => {
  const ctx = {
    patient: {
      age: 40,
      employmentType: "permanent_employee" as const,
      isNonEuCitizen: false,
    },
    requestedAmount: 3000,
    durationMonths: 12,
    firstInstallmentDelayDays: 30,
    calculationDate: new Date(2026, 8, 11).getTime(),
  };

  it("A) TI senza seniority → verification senza “inferiore ai 12 mesi”", () => {
    const result = evaluatePolicyRule(seniorityRule, {
      ...ctx,
      patient: { ...ctx.patient, employmentSeniorityMonths: undefined },
    });
    expect(result.status).toBe("verification_required");
    expect(result.message).toMatch(/Data di assunzione non indicata/i);
    expect(result.message).not.toMatch(/inferiore ai 12 mesi/i);
  });

  it("B) TI con 6 mesi → verification con motivazione anzianità", () => {
    const result = evaluatePolicyRule(seniorityRule, {
      ...ctx,
      patient: { ...ctx.patient, employmentSeniorityMonths: 6 },
    });
    expect(result.status).toBe("verification_required");
    expect(result.message).toMatch(/12 mesi/i);
  });

  it("C) TI con 18 mesi → passed", () => {
    const result = evaluatePolicyRule(seniorityRule, {
      ...ctx,
      patient: { ...ctx.patient, employmentSeniorityMonths: 18 },
    });
    expect(result.status).toBe("passed");
  });
});
