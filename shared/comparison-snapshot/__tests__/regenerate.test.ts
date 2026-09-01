import { describe, expect, it } from "vitest";
import { calculateFinancialSolution } from "../../financial-engine/index.ts";
import { mapCalculationSummary } from "../mapper.ts";
import {
  STALE_ENGINE_VERSION_WARNING,
  getStaleEngineVersionWarning,
  isStaleEngineVersion,
  regenerateAmortizationFromInputSnapshot,
} from "../regenerate.ts";

describe("regenerateAmortizationFromInputSnapshot", () => {
  it("rigenera un piano coerente con il riepilogo e saldo finale zero", () => {
    const input = {
      requestedAmount: 3000,
      durationMonths: 24,
      customerTanPercent: 7.5,
      openingFeeType: "fixed" as const,
      openingFeeValue: 50,
      collectionFeePerInstallment: 1,
      firstInstallmentDelayDays: 30,
      internalCostPercentAt24Months: 1.5,
    };

    const original = calculateFinancialSolution(input);
    const expectedSummary = mapCalculationSummary(original);
    expect(expectedSummary).toBeDefined();

    const regenerated = regenerateAmortizationFromInputSnapshot({
      calculationInput: input,
      expectedSummary: expectedSummary!,
      snapshotEngineVersion: "1.0.0",
      currentEngineVersion: "1.0.0",
    });

    expect(regenerated.summaryMatches).toBe(true);
    expect(regenerated.warnings).toHaveLength(0);
    expect(regenerated.amortizationSchedule.length).toBe(24);
    expect(
      regenerated.amortizationSchedule[regenerated.amortizationSchedule.length - 1]
        ?.closingBalance,
    ).toBe(0);
    expect(regenerated.regeneratedSummary.regularTotalInstallmentAmount).toBe(
      expectedSummary!.regularTotalInstallmentAmount,
    );
  });

  it("aggiunge warning se il riepilogo atteso diverge oltre €0,01", () => {
    const input = {
      requestedAmount: 2000,
      durationMonths: 12,
      customerTanPercent: 5,
      openingFeeType: "none" as const,
      openingFeeValue: 0,
      collectionFeePerInstallment: 0,
      firstInstallmentDelayDays: 30,
    };

    const original = calculateFinancialSolution(input);
    const expectedSummary = mapCalculationSummary(original)!;
    const tampered = {
      ...expectedSummary,
      regularTotalInstallmentAmount:
        expectedSummary.regularTotalInstallmentAmount + 1,
    };

    const regenerated = regenerateAmortizationFromInputSnapshot({
      calculationInput: input,
      expectedSummary: tampered,
    });

    expect(regenerated.summaryMatches).toBe(false);
    expect(regenerated.differingFields).toContain(
      "regularTotalInstallmentAmount",
    );
    expect(regenerated.warnings.length).toBeGreaterThan(0);
    expect(regenerated.amortizationSchedule.length).toBe(12);
  });
});

describe("stale engine version", () => {
  it("rileva versione stale e fornisce warning", () => {
    expect(isStaleEngineVersion("1.0.0", "1.0.0")).toBe(false);
    expect(isStaleEngineVersion("1.0.0", "2.0.0")).toBe(true);
    expect(getStaleEngineVersionWarning("1.0.0", "2.0.0")).toBe(
      STALE_ENGINE_VERSION_WARNING,
    );
    expect(getStaleEngineVersionWarning("1.0.0", "1.0.0")).toBeUndefined();
  });

  it("include warning stale nella rigenerazione", () => {
    const regenerated = regenerateAmortizationFromInputSnapshot({
      calculationInput: {
        requestedAmount: 1000,
        durationMonths: 12,
        customerTanPercent: 0,
        openingFeeType: "none",
        openingFeeValue: 0,
        collectionFeePerInstallment: 0,
        firstInstallmentDelayDays: 30,
      },
      snapshotEngineVersion: "0.9.0",
      currentEngineVersion: "1.0.0",
    });

    expect(regenerated.warnings).toContain(STALE_ENGINE_VERSION_WARNING);
  });
});
