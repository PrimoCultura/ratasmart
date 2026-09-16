import { describe, expect, it } from "vitest";
import {
  classifyComparisonOutcome,
  classifyRuleTypeToMacro,
  coverageRate,
  inPeriod,
  isSimulationSoftDeleted,
  mean,
  median,
  percent,
  reasonLabelForRuleType,
} from "../metrics.ts";

describe("admin-analytics soft-delete helpers", () => {
  it("A) soft-delete flag", () => {
    expect(isSimulationSoftDeleted({})).toBe(false);
    expect(isSimulationSoftDeleted({ deletedAt: Date.now() })).toBe(true);
  });

  it("B) deleted excluded conceptually from analytics inputs", () => {
    const rows = [
      { deletedAt: undefined, amount: 100 },
      { deletedAt: 1, amount: 9999 },
      { deletedAt: undefined, amount: 200 },
    ];
    const active = rows.filter((row) => !isSimulationSoftDeleted(row));
    expect(active.map((row) => row.amount)).toEqual([100, 200]);
    expect(mean(active.map((row) => row.amount))).toBe(150);
  });

  it("C) restore clears soft-delete conceptually", () => {
    const before = { deletedAt: 123 as number | undefined };
    expect(isSimulationSoftDeleted(before)).toBe(true);
    const after = { ...before, deletedAt: undefined };
    expect(isSimulationSoftDeleted(after)).toBe(false);
  });

  it("D) disable user is separate from soft-delete simulation", () => {
    expect(isSimulationSoftDeleted({})).toBe(false);
  });
});

describe("admin-analytics KPI math", () => {
  it("E) coverage rate", () => {
    expect(
      coverageRate({ withCompatible: 7, withValidComparison: 10 }),
    ).toBe(0.7);
    expect(
      coverageRate({ withCompatible: 0, withValidComparison: 0 }),
    ).toBeNull();
  });

  it("F) compatible / verification / no-solution", () => {
    expect(
      classifyComparisonOutcome({
        compatibleSolutionsCount: 2,
        verificationRequiredSolutionsCount: 5,
      }),
    ).toBe("compatible");
    expect(
      classifyComparisonOutcome({
        compatibleSolutionsCount: 0,
        verificationRequiredSolutionsCount: 1,
      }),
    ).toBe("verification_required");
    expect(
      classifyComparisonOutcome({
        compatibleSolutionsCount: 0,
        verificationRequiredSolutionsCount: 0,
      }),
    ).toBe("no_solution");
  });

  it("G) mean", () => {
    expect(mean([1000, 2000, 3000])).toBe(2000);
    expect(mean([])).toBeNull();
  });

  it("H) median", () => {
    expect(median([100, 200, 1000])).toBe(200);
    expect(median([10, 20, 30, 40])).toBe(25);
    expect(median([])).toBeNull();
  });

  it("I) active users percent", () => {
    expect(percent(3, 10)).toBe(0.3);
    expect(percent(0, 0)).toBeNull();
  });

  it("J/K) reason labels and macro categories", () => {
    expect(reasonLabelForRuleType("minimum_age")).toBe("Età");
    expect(classifyRuleTypeToMacro("minimum_amount")).toBe("PRODUCT_GAP");
    expect(classifyRuleTypeToMacro("employment_type_allowed")).toBe(
      "PATIENT_ELIGIBILITY",
    );
    expect(classifyRuleTypeToMacro("missing_birth_date")).toBe(
      "MISSING_INFORMATION",
    );
    expect(classifyRuleTypeToMacro("product_not_available_on_network")).toBe(
      "NETWORK_AVAILABILITY",
    );
    expect(classifyRuleTypeToMacro("custom_unknown")).toBe("OTHER");
  });

  it("L/M) period filter helper", () => {
    const from = Date.UTC(2026, 8, 1);
    const to = Date.UTC(2026, 8, 30);
    expect(inPeriod(Date.UTC(2026, 8, 15), from, to)).toBe(true);
    expect(inPeriod(Date.UTC(2026, 7, 31), from, to)).toBe(false);
  });
});
