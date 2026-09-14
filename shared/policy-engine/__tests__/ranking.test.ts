import { describe, expect, it } from "vitest";
import {
  findNearestTargetSolution,
  formatTargetDistance,
  rankFinancialSolutions,
} from "../ranking.ts";
import type {
  CompatibilityEvaluation,
  RuntimeFinancialSolution,
} from "../types.ts";
import type { FinancialCalculationResult } from "../../financial-engine/types.ts";

function compatibility(
  status: CompatibilityEvaluation["status"],
  reasons: string[] = [],
): CompatibilityEvaluation {
  return {
    status,
    passedRules: [],
    failedRules: [],
    verificationRules: [],
    notApplicableRules: [],
    reasons,
    verificationReasons: status === "verification_required" ? reasons : [],
  };
}

function baseCalculation(
  overrides: Partial<FinancialCalculationResult> = {},
): FinancialCalculationResult {
  return {
    requestedAmount: 5000,
    openingFeeAmount: 0,
    financedAmount: 5000,
    durationMonths: 24,
    firstInstallmentDelayDays: 30,
    customerTanPercent: 10,
    monthlyNominalRate: 0.1 / 12,
    theoreticalBaseInstallmentAmount: 230,
    regularBaseInstallmentAmount: 230,
    collectionFeePerInstallment: 0,
    regularTotalInstallmentAmount: 230,
    finalTotalInstallmentAmount: 230,
    totalPrincipalRepaid: 5000,
    totalCustomerInterest: 500,
    totalCollectionFees: 0,
    totalCustomerRepayment: 5500,
    totalCustomerCosts: 500,
    installmentFeeType: "none",
    installmentFeeValue: 0,
    internalCostBase: "financed_amount",
    internalCostPercentAt24Months: 0,
    internalCostPercentApplied: 0,
    internalCostAmount: 0,
    netAmountPaidToCompany: 5000,
    activeCommissionPercent: 0,
    activeCommissionAmount: 0,
    companyEconomicValue: 5000,
    estimatedTaeg: {
      success: true,
      monthlyRate: 0.01,
      annualEffectiveRate: 0.12,
      taegPercent: 12,
      iterations: 1,
    },
    amortizationSchedule: [],
    warnings: [],
    ...overrides,
  };
}

function solution(
  partial: Partial<RuntimeFinancialSolution> &
    Pick<
      RuntimeFinancialSolution,
      "solutionId" | "companyName" | "tableCode" | "compatibility"
    >,
): RuntimeFinancialSolution {
  return {
    solutionId: partial.solutionId,
    companyId: partial.companyId ?? "c1",
    companyName: partial.companyName,
    companyShortName: partial.companyShortName ?? partial.companyName,
    productId: "p1",
    productName: "Prodotto",
    financialTableId: partial.financialTableId ?? partial.solutionId,
    financialTableVersion: 1,
    tableCode: partial.tableCode,
    tableDisplayName: partial.tableCode,
    category: partial.category ?? "standard",
    network: "PCG",
    durationMonths: 24,
    firstInstallmentDelayDays: 30,
    calculation: partial.calculation ?? baseCalculation(),
    compatibility: partial.compatibility,
    isCompanyPriority: partial.isCompanyPriority ?? false,
    priorityScore: partial.priorityScore ?? 0,
    priorityLabel: partial.priorityLabel,
    internalMessageIds: [],
    requiresManagerAuthorizationNotice:
      partial.requiresManagerAuthorizationNotice ?? false,
    distanceFromTargetInstallment: partial.distanceFromTargetInstallment,
    technicalExclusionReasons: partial.technicalExclusionReasons ?? [],
  };
}

describe("rankFinancialSolutions", () => {
  it("compatibili sempre prima", () => {
    const ranked = rankFinancialSolutions([
      solution({
        solutionId: "inc",
        companyName: "Aaa",
        tableCode: "A",
        compatibility: compatibility("not_compatible", ["x"]),
      }),
      solution({
        solutionId: "ok",
        companyName: "Zzz",
        tableCode: "Z",
        compatibility: compatibility("compatible"),
      }),
      solution({
        solutionId: "ver",
        companyName: "Mmm",
        tableCode: "M",
        compatibility: compatibility("verification_required", ["check"]),
      }),
    ]);
    expect(ranked.map((item) => item.solutionId)).toEqual([
      "ok",
      "ver",
      "inc",
    ]);
  });

  it("priorità attiva porta una soluzione compatibile in alto", () => {
    const ranked = rankFinancialSolutions([
      solution({
        solutionId: "low",
        companyName: "Banca A",
        tableCode: "A",
        compatibility: compatibility("compatible"),
        priorityScore: 0,
        calculation: baseCalculation({
          regularTotalInstallmentAmount: 100,
        }),
      }),
      solution({
        solutionId: "prio",
        companyName: "Banca B",
        tableCode: "B",
        compatibility: compatibility("compatible"),
        priorityScore: 100,
        isCompanyPriority: true,
        calculation: baseCalculation({
          regularTotalInstallmentAmount: 200,
        }),
      }),
    ]);
    expect(ranked[0]?.solutionId).toBe("prio");
  });

  it("priorità non modifica soluzioni da verificare", () => {
    const ranked = rankFinancialSolutions([
      solution({
        solutionId: "v1",
        companyName: "B",
        tableCode: "B",
        compatibility: compatibility("verification_required"),
        priorityScore: 999,
        calculation: baseCalculation({
          regularTotalInstallmentAmount: 200,
        }),
      }),
      solution({
        solutionId: "v2",
        companyName: "A",
        tableCode: "A",
        compatibility: compatibility("verification_required"),
        priorityScore: 0,
        calculation: baseCalculation({
          regularTotalInstallmentAmount: 100,
        }),
      }),
    ]);
    expect(ranked[0]?.solutionId).toBe("v2");
  });

  it("priorità non modifica incompatibili", () => {
    const ranked = rankFinancialSolutions([
      solution({
        solutionId: "i1",
        companyName: "B",
        tableCode: "B",
        compatibility: compatibility("not_compatible", ["a", "b"]),
        priorityScore: 999,
        technicalExclusionReasons: [],
      }),
      solution({
        solutionId: "i2",
        companyName: "A",
        tableCode: "A",
        compatibility: compatibility("not_compatible", ["a"]),
        priorityScore: 0,
      }),
    ]);
    expect(ranked[0]?.solutionId).toBe("i2");
  });

  it("a parità di priorità vince rata più bassa", () => {
    const ranked = rankFinancialSolutions([
      solution({
        solutionId: "high",
        companyName: "A",
        tableCode: "A",
        compatibility: compatibility("compatible"),
        priorityScore: 10,
        calculation: baseCalculation({
          regularTotalInstallmentAmount: 150,
        }),
      }),
      solution({
        solutionId: "low",
        companyName: "A",
        tableCode: "B",
        compatibility: compatibility("compatible"),
        priorityScore: 10,
        calculation: baseCalculation({
          regularTotalInstallmentAmount: 120,
        }),
      }),
    ]);
    expect(ranked[0]?.solutionId).toBe("low");
  });

  it("senza costo aziendale precede tasso zero/agevolato anche con rata più alta", () => {
    const ranked = rankFinancialSolutions([
      solution({
        solutionId: "zero",
        companyName: "Agos",
        tableCode: "PCA",
        category: "zero_interest",
        compatibility: compatibility("compatible"),
        priorityScore: 100,
        isCompanyPriority: true,
        calculation: baseCalculation({
          regularTotalInstallmentAmount: 100,
          internalCostAmount: 150,
          internalCostPercentApplied: 5,
          customerTanPercent: 0,
        }),
      }),
      solution({
        solutionId: "standard",
        companyName: "Agos",
        tableCode: "NBQ",
        category: "standard",
        compatibility: compatibility("compatible"),
        priorityScore: 0,
        calculation: baseCalculation({
          regularTotalInstallmentAmount: 180,
          internalCostAmount: 0,
          internalCostPercentApplied: 0,
          customerTanPercent: 10.5,
        }),
      }),
    ]);
    expect(ranked.map((item) => item.solutionId)).toEqual([
      "standard",
      "zero",
    ]);
  });

  it("dentro il gruppo senza costo resta priorità ↓ poi rata ↑", () => {
    const ranked = rankFinancialSolutions([
      solution({
        solutionId: "std-high-rata",
        companyName: "A",
        tableCode: "A",
        compatibility: compatibility("compatible"),
        priorityScore: 0,
        calculation: baseCalculation({
          regularTotalInstallmentAmount: 200,
          internalCostAmount: 0,
        }),
      }),
      solution({
        solutionId: "std-prio",
        companyName: "B",
        tableCode: "B",
        compatibility: compatibility("compatible"),
        priorityScore: 50,
        calculation: baseCalculation({
          regularTotalInstallmentAmount: 220,
          internalCostAmount: 0,
        }),
      }),
      solution({
        solutionId: "with-cost",
        companyName: "C",
        tableCode: "C",
        compatibility: compatibility("compatible"),
        priorityScore: 999,
        calculation: baseCalculation({
          regularTotalInstallmentAmount: 90,
          internalCostAmount: 100,
        }),
      }),
    ]);
    expect(ranked.map((item) => item.solutionId)).toEqual([
      "std-prio",
      "std-high-rata",
      "with-cost",
    ]);
  });

  it("NE9-like TAN 0 senza costo/auth resta nel gruppo senza costo", () => {
    const ranked = rankFinancialSolutions([
      solution({
        solutionId: "ne9",
        companyName: "Compass",
        tableCode: "NE9",
        category: "small_amount",
        compatibility: compatibility("compatible"),
        calculation: baseCalculation({
          customerTanPercent: 0,
          regularTotalInstallmentAmount: 106,
          internalCostAmount: 0,
          installmentFeeType: "percentage_of_requested_amount",
          installmentFeeValue: 0.6,
          collectionFeePerInstallment: 6,
        }),
      }),
      solution({
        solutionId: "s8l",
        companyName: "Deutsche Bank",
        tableCode: "S8L",
        category: "zero_interest",
        compatibility: compatibility("compatible"),
        requiresManagerAuthorizationNotice: true,
        calculation: baseCalculation({
          customerTanPercent: 0,
          regularTotalInstallmentAmount: 90,
          internalCostAmount: 142.5,
        }),
      }),
    ]);
    expect(ranked.map((item) => item.solutionId)).toEqual(["ne9", "s8l"]);
  });

  it("soluzione incompatibile mai mostrata come prioritaria", () => {
    const item = solution({
      solutionId: "inc",
      companyName: "A",
      tableCode: "A",
      compatibility: compatibility("not_compatible", ["x"]),
      priorityScore: 0,
      isCompanyPriority: false,
    });
    expect(item.isCompanyPriority).toBe(false);
  });
});

describe("rata obiettivo", () => {
  it("formatta distanza sopra e sotto", () => {
    expect(formatTargetDistance(12.5)).toBe("€12,50 sopra la rata obiettivo");
    expect(formatTargetDistance(-8.2)).toBe("€8,20 sotto la rata obiettivo");
  });

  it("seleziona il valore più vicino", () => {
    const nearest = findNearestTargetSolution(
      [
        solution({
          solutionId: "above",
          companyName: "A",
          tableCode: "A",
          compatibility: compatibility("compatible"),
          distanceFromTargetInstallment: 12.5,
        }),
        solution({
          solutionId: "below",
          companyName: "B",
          tableCode: "B",
          compatibility: compatibility("compatible"),
          distanceFromTargetInstallment: -8.2,
        }),
      ],
      100,
    );
    expect(nearest?.solutionId).toBe("below");
  });
});
