import { describe, expect, it } from "vitest";
import {
  AGOS_PCG_TABLES,
  buildTableEconomicsFromSeed,
} from "../../../convex/lib/agosPcg2026Data.ts";
import { calculateFinancialSolution } from "../../financial-engine/index.ts";
import {
  buildComparisonResult,
  type RuntimeFinancialTable,
} from "../../policy-engine/comparison.ts";
import type { RuntimeFinancialSolution } from "../../policy-engine/types.ts";
import {
  analyzeZeroInterestAlternative,
  computeDoctorCompensationBaseReduction,
  computeDoctorCompensationBreakEvenPercent,
  computeNetCompanyDifferenceBeforeDoctorCompensation,
  findEquivalentDiscountPercent,
  summarizeEconomicImpact,
  ZERO_INTEREST_ALTERNATIVE_CONFIG,
  ZERO_VS_STANDARD_AUTONOMY_WARNING,
  type ZeroInterestAlternativeAnalysis,
} from "../index.ts";

function seedToRuntime(
  tableCode: string,
  id = `t-${tableCode}`,
): RuntimeFinancialTable {
  const seed = AGOS_PCG_TABLES.find((item) => item.tableCode === tableCode);
  if (!seed) throw new Error(`Seed ${tableCode} non trovato`);
  const economics = buildTableEconomicsFromSeed(seed);
  return {
    id,
    companyId: "agos",
    productId: `prod-${seed.productCode}`,
    network: "PCG",
    tableCode: seed.tableCode,
    displayName: seed.displayName,
    description: seed.description,
    category: seed.category,
    version: 1,
    ...economics,
    isActive: true,
  };
}

function comparePcg(input: {
  tables: RuntimeFinancialTable[];
  requestedAmount: number;
  durationMonths: number;
  delayDays?: number;
}) {
  return buildComparisonResult({
    simulationId: "sim-zia",
    network: "PCG",
    calculationDate: new Date(2026, 0, 15).getTime(),
    patient: {
      age: 40,
      employmentType: "permanent_employee",
      isNonEuCitizen: false,
    },
    requestedAmount: input.requestedAmount,
    selectedDurationMonths: input.durationMonths,
    selectedFirstInstallmentDelayDays: input.delayDays ?? 30,
    companies: [
      { id: "agos", name: "Agos", shortName: "Agos", isActive: true },
    ],
    products: input.tables.map((table) => ({
      id: table.productId,
      companyId: "agos",
      name: table.tableCode,
      code: table.tableCode,
      isActive: true,
    })),
    tables: input.tables,
    rulesByTableId: Object.fromEntries(input.tables.map((t) => [t.id, []])),
    priorities: [],
    internalMessages: [],
  });
}

function tablesByIdFrom(tables: RuntimeFinancialTable[]) {
  return Object.fromEntries(tables.map((table) => [table.id, table]));
}

function assertAutonomyWarning(text: string) {
  expect(text).toMatch(/livelli di autonomia/i);
  expect(text).not.toMatch(/10%/);
  expect(text).not.toMatch(/\bAM\b/);
  expect(text).not.toMatch(/District/i);
  expect(text).not.toMatch(/18%/);
}

describe("zero-interest-alternative", () => {
  const pca = seedToRuntime("PCA");
  const nbq = seedToRuntime("NBQ");

  it("A) patientRequestsZeroInterest=false → nessuna analysis", () => {
    const result = comparePcg({
      tables: [pca, nbq],
      requestedAmount: 5000,
      durationMonths: 18,
    });
    const analysis = analyzeZeroInterestAlternative({
      enabled: false,
      requestedAmount: 5000,
      referenceDate: Date.now(),
      compatibleSolutions: result.compatibleSolutions,
      tablesById: tablesByIdFrom([pca, nbq]),
    });
    expect(analysis.enabled).toBe(false);
    expect(analysis.alternatives).toEqual([]);
    expect(analysis.primary).toBeUndefined();
  });

  it("B) target = zero.totalCustomerRepayment, NON requestedAmount", () => {
    const zeroCalc = calculateFinancialSolution({
      requestedAmount: 5000,
      durationMonths: 18,
      customerTanPercent: 0,
      openingFeeType: "fixed",
      openingFeeValue: 100,
      collectionFeePerInstallment: 0,
      firstInstallmentDelayDays: 30,
    });
    expect(zeroCalc.financedAmount).toBe(5100);
    expect(zeroCalc.totalCustomerRepayment).toBe(5100);
    expect(zeroCalc.totalCustomerRepayment).not.toBe(5000);

    const nbqEconomics = {
      customerTanPercent: 10.5,
      openingFeeType: "percentage" as const,
      openingFeeValue: 1.5,
      collectionFeePerInstallment: 1.5,
      internalCostPercentApplied: 0,
      firstInstallmentDelayDays: 30,
      minimumAmount: 760,
      maximumAmount: 20000,
      durationMonths: 18,
    };

    const wrongTarget = findEquivalentDiscountPercent({
      originalAmount: 5000,
      targetPatientTotal: 5000,
      economics: nbqEconomics,
    });
    const correctTarget = findEquivalentDiscountPercent({
      originalAmount: 5000,
      targetPatientTotal: zeroCalc.totalCustomerRepayment,
      economics: nbqEconomics,
    });

    expect(correctTarget.found).toBe(true);
    expect(correctTarget.calculation?.totalCustomerRepayment).toBeCloseTo(
      5100,
      0,
    );
    // Se usasse requestedAmount come target otterrebbe uno sconto diverso.
    expect(wrongTarget.discountPercent).not.toBe(correctTarget.discountPercent);
  });

  it("C) zero con collection fee → target = totalCustomerRepayment completo", () => {
    const zeroCalc = calculateFinancialSolution({
      requestedAmount: 5000,
      durationMonths: 18,
      customerTanPercent: 0,
      openingFeeType: "fixed",
      openingFeeValue: 100,
      collectionFeePerInstallment: 1.5,
      internalCostPercentApplied: 6.61,
      firstInstallmentDelayDays: 30,
    });
    expect(zeroCalc.financedAmount).toBe(5100);
    expect(zeroCalc.totalCustomerRepayment).toBeGreaterThan(
      zeroCalc.requestedAmount + zeroCalc.openingFeeAmount,
    );

    const result = comparePcg({
      tables: [pca, nbq],
      requestedAmount: 5000,
      durationMonths: 18,
    });
    const analysis = analyzeZeroInterestAlternative({
      enabled: true,
      requestedAmount: 5000,
      referenceDate: Date.now(),
      compatibleSolutions: result.compatibleSolutions,
      tablesById: tablesByIdFrom([pca, nbq]),
    });
    expect(analysis.primary?.zeroRatePatientTotal).toBe(
      zeroCalc.totalCustomerRepayment,
    );
    expect(analysis.primary?.zeroRatePatientTotal).not.toBe(
      zeroCalc.requestedAmount + zeroCalc.openingFeeAmount,
    );
  });

  it("D) zero + standard stessa durata → trova sconto equivalente", () => {
    const result = comparePcg({
      tables: [pca, nbq],
      requestedAmount: 5000,
      durationMonths: 18,
    });
    const analysis = analyzeZeroInterestAlternative({
      enabled: true,
      requestedAmount: 5000,
      referenceDate: Date.now(),
      compatibleSolutions: result.compatibleSolutions,
      tablesById: tablesByIdFrom([pca, nbq]),
    });
    expect(analysis.primary).toBeDefined();
    expect(analysis.primary?.equivalent).toBe(true);
    expect(analysis.primary?.durationMonths).toBe(18);
    expect(
      Math.abs(
        (analysis.primary?.standardPatientTotal ?? 0) -
          (analysis.primary?.zeroRatePatientTotal ?? 0),
      ),
    ).toBeLessThanOrEqual(
      Math.max(
        ZERO_INTEREST_ALTERNATIVE_CONFIG.equivalenceToleranceEuro,
        ((analysis.primary?.zeroRatePatientTotal ?? 0) *
          ZERO_INTEREST_ALTERNATIVE_CONFIG.equivalenceTolerancePercent) /
          100,
      ),
    );
  });

  it("E) sconto richiesto ~5–10% → proposta generata (PCG reale)", () => {
    const result = comparePcg({
      tables: [pca, nbq],
      requestedAmount: 5000,
      durationMonths: 18,
    });
    const analysis = analyzeZeroInterestAlternative({
      enabled: true,
      requestedAmount: 5000,
      referenceDate: Date.now(),
      compatibleSolutions: result.compatibleSolutions,
      tablesById: tablesByIdFrom([pca, nbq]),
    });
    expect(analysis.primary?.discountPercent).toBeGreaterThanOrEqual(5);
    expect(analysis.primary?.discountPercent).toBeLessThanOrEqual(12);
  });

  it("F) warning autonomia presente senza CM/AM/District/18%", () => {
    expect(ZERO_VS_STANDARD_AUTONOMY_WARNING).toMatch(/livelli di autonomia/i);
    assertAutonomyWarning(ZERO_VS_STANDARD_AUTONOMY_WARNING);

    const result = comparePcg({
      tables: [pca, nbq],
      requestedAmount: 5000,
      durationMonths: 18,
    });
    const analysis = analyzeZeroInterestAlternative({
      enabled: true,
      requestedAmount: 5000,
      referenceDate: Date.now(),
      compatibleSolutions: result.compatibleSolutions,
      tablesById: tablesByIdFrom([pca, nbq]),
    });
    expect(analysis.primary?.warning).toBe(ZERO_VS_STANDARD_AUTONOMY_WARNING);
    assertAutonomyWarning(analysis.primary!.warning);
  });

  it("G) sconto matematico > max configurato → nessuna proposta", () => {
    const search = findEquivalentDiscountPercent({
      originalAmount: 5000,
      targetPatientTotal: 2000,
      economics: {
        customerTanPercent: 10.5,
        openingFeeType: "percentage",
        openingFeeValue: 1.5,
        collectionFeePerInstallment: 1.5,
        firstInstallmentDelayDays: 30,
        minimumAmount: 760,
        maximumAmount: 20000,
        durationMonths: 18,
      },
      config: {
        ...ZERO_INTEREST_ALTERNATIVE_CONFIG,
        maxSuggestedDiscountPercent: 18,
      },
    });
    expect(search.found).toBe(false);
    expect(search.beyondConfiguredLimit).toBe(true);

    const result = comparePcg({
      tables: [pca, nbq],
      requestedAmount: 5000,
      durationMonths: 18,
    });
    // Forza target impossibile sostituendo il calcolo zero con totale bassissimo.
    const patched = result.compatibleSolutions.map((solution) => {
      if (solution.tableCode !== "PCA" || !solution.calculation) return solution;
      return {
        ...solution,
        calculation: {
          ...solution.calculation,
          totalCustomerRepayment: 2000,
        },
      };
    });
    const analysis = analyzeZeroInterestAlternative({
      enabled: true,
      requestedAmount: 5000,
      referenceDate: Date.now(),
      compatibleSolutions: patched,
      tablesById: tablesByIdFrom([pca, nbq]),
    });
    expect(analysis.primary).toBeUndefined();
    expect(analysis.messages.join(" ")).toMatch(/limite configurato/i);
  });

  it("H) standard incompatible → non usato", () => {
    const result = comparePcg({
      tables: [pca, nbq],
      requestedAmount: 5000,
      durationMonths: 18,
    });
    const onlyZeroCompatible = result.compatibleSolutions.filter(
      (item) => item.category !== "standard",
    );
    const analysis = analyzeZeroInterestAlternative({
      enabled: true,
      requestedAmount: 5000,
      referenceDate: Date.now(),
      compatibleSolutions: onlyZeroCompatible,
      tablesById: tablesByIdFrom([pca, nbq]),
    });
    expect(analysis.alternatives).toHaveLength(0);
    expect(analysis.messages.join(" ")).toMatch(/stessa durata|Nessuna/i);
  });

  it("I) zero verification_required → non usato come compatible", () => {
    const result = comparePcg({
      tables: [pca, nbq],
      requestedAmount: 5000,
      durationMonths: 18,
    });
    const analysis = analyzeZeroInterestAlternative({
      enabled: true,
      requestedAmount: 5000,
      referenceDate: Date.now(),
      compatibleSolutions: [],
      tablesById: tablesByIdFrom([pca, nbq]),
    });
    expect(analysis.alternatives).toHaveLength(0);
    // verification solutions devono essere ignorate anche se presenti altrove
    expect(result.verificationRequiredSolutions).toBeDefined();
    const withVerificationOnly = analyzeZeroInterestAlternative({
      enabled: true,
      requestedAmount: 5000,
      referenceDate: Date.now(),
      compatibleSolutions: result.verificationRequiredSolutions as RuntimeFinancialSolution[],
      tablesById: tablesByIdFrom([pca, nbq]),
    });
    expect(withVerificationOnly.alternatives).toHaveLength(0);
  });

  it("J) più standard → preferisce senza company cost e minore sconto", () => {
    const nbqAlt = seedToRuntime("NBQ", "t-NBQ-cost");
    const result = comparePcg({
      tables: [pca, nbq, nbqAlt],
      requestedAmount: 5000,
      durationMonths: 18,
    });
    const standards = result.compatibleSolutions.filter(
      (item) => item.category === "standard",
    );
    expect(standards.length).toBeGreaterThanOrEqual(2);

    const patched: RuntimeFinancialSolution[] = result.compatibleSolutions.map(
      (solution) => {
        if (solution.financialTableId === "t-NBQ-cost") {
          return {
            ...solution,
            requiresManagerAuthorizationNotice: true,
            priorityScore: 999,
            calculation: solution.calculation
              ? {
                  ...solution.calculation,
                  internalCostAmount: 200,
                }
              : null,
          };
        }
        return { ...solution, priorityScore: 1 };
      },
    );

    const analysis = analyzeZeroInterestAlternative({
      enabled: true,
      requestedAmount: 5000,
      referenceDate: Date.now(),
      compatibleSolutions: patched,
      tablesById: tablesByIdFrom([pca, nbq, nbqAlt]),
    });
    expect(analysis.alternatives.length).toBeGreaterThanOrEqual(2);
    expect(analysis.primary?.standardSolutionId).toContain("t-NBQ:18:30");
    expect(analysis.primary?.standardCompanyCostEuro).toBe(0);
  });

  it("K) history → snapshot non ricalcolato (immutabile)", () => {
    const snapshot: ZeroInterestAlternativeAnalysis = {
      version: "1.0.0",
      enabled: true,
      referenceDate: 1,
      originalAmount: 5000,
      primary: {
        zeroSolutionId: "old-zero",
        standardSolutionId: "old-std",
        zeroCompanyShortName: "Agos",
        zeroTableCode: "PCA",
        standardCompanyShortName: "Agos",
        standardTableCode: "NBQ",
        durationMonths: 18,
        originalAmount: 5000,
        discountedAmount: 4500,
        discountPercent: 10,
        zeroRateRequestedAmount: 5000,
        zeroRateOpeningFeeAmount: 100,
        zeroRateFinancedAmount: 5100,
        zeroRatePatientTotal: 5127,
        standardRequestedAmount: 4500,
        standardOpeningFeeAmount: 67.5,
        standardFinancedAmount: 4567.5,
        standardPatientTotal: 5120,
        patientTotalDifferenceEuro: -7,
        zeroRateInstallment: 284.83,
        standardInstallment: 280,
        installmentDifferenceEuro: -4.83,
        zeroRateCompanyCostEuro: 337.11,
        standardCompanyCostEuro: 0,
        zeroRateNetToCompanyEuro: 4662.89,
        standardNetToCompanyEuro: 4500,
        discountValueEuro: 500,
        netCompanyDifferenceBeforeDoctorCompensationEuro: -162.89,
        doctorCompensationBaseReductionEuro: 500,
        doctorCompensationBreakEvenPercent: 32.58,
        equivalent: true,
        warning: ZERO_VS_STANDARD_AUTONOMY_WARNING,
        doctorCompensationNote:
          "Con lo sconto si riduce anche la base di fatturato sulla quale viene calcolato il compenso medico.",
      },
      alternatives: [],
      messages: [],
    };

    // La history deve mostrare lo snapshot così com'è, senza ricalcolo.
    expect(snapshot.primary?.discountPercent).toBe(10);
    expect(snapshot.primary?.discountedAmount).toBe(4500);
    const live = analyzeZeroInterestAlternative({
      enabled: true,
      requestedAmount: 5000,
      referenceDate: Date.now(),
      compatibleSolutions: comparePcg({
        tables: [pca, nbq],
        requestedAmount: 5000,
        durationMonths: 18,
      }).compatibleSolutions,
      tablesById: tablesByIdFrom([pca, nbq]),
    });
    expect(live.primary?.discountPercent).not.toBe(
      snapshot.primary?.discountPercent,
    );
  });

  it("L) warning contiene livelli di autonomia e non soglie operative", () => {
    assertAutonomyWarning(ZERO_VS_STANDARD_AUTONOMY_WARNING);
  });

  it("PCG reale PCA vs NBQ 18m: numeri financial-engine e equivalenza", () => {
    const result = comparePcg({
      tables: [pca, nbq],
      requestedAmount: 5000,
      durationMonths: 18,
    });
    const analysis = analyzeZeroInterestAlternative({
      enabled: true,
      requestedAmount: 5000,
      referenceDate: Date.now(),
      compatibleSolutions: result.compatibleSolutions,
      tablesById: tablesByIdFrom([pca, nbq]),
    });
    const primary = analysis.primary!;
    expect(primary.zeroRateRequestedAmount).toBe(5000);
    expect(primary.zeroRateOpeningFeeAmount).toBe(100);
    expect(primary.zeroRateFinancedAmount).toBe(5100);
    expect(primary.zeroRatePatientTotal).toBe(5127);
    expect(primary.discountedAmount).toBe(4630);
    expect(primary.discountPercent).toBe(7.4);
    expect(primary.standardOpeningFeeAmount).toBe(69.45);
    expect(primary.standardFinancedAmount).toBe(4699.45);
    expect(primary.standardPatientTotal).toBe(5126.73);
    expect(Math.abs(primary.patientTotalDifferenceEuro)).toBeLessThanOrEqual(
      10,
    );
    expect(primary.zeroRateCompanyCostEuro).toBe(337.11);
    expect(primary.standardCompanyCostEuro).toBe(0);
    expect(primary.zeroRateNetToCompanyEuro).toBe(4662.89);
    expect(primary.standardNetToCompanyEuro).toBe(4630);
    expect(primary.netCompanyDifferenceBeforeDoctorCompensationEuro).toBe(
      -32.89,
    );
    expect(primary.doctorCompensationBaseReductionEuro).toBe(370);
    expect(primary.doctorCompensationBreakEvenPercent).toBe(8.89);

    const impact = summarizeEconomicImpact(primary);
    expect(impact.netCompanyDifferenceBeforeDoctorCompensationEuro).toBe(
      -32.89,
    );
    expect(impact.doctorCompensationBaseReductionEuro).toBe(370);
    expect(impact.doctorCompensationBreakEvenPercent).toBe(8.89);
  });
});

describe("zero-interest-alternative economic impact helpers", () => {
  it("delta netto positivo → standard migliore, no break-even", () => {
    const delta = computeNetCompanyDifferenceBeforeDoctorCompensation({
      standardNetToCompanyEuro: 4800,
      zeroRateNetToCompanyEuro: 4662.89,
    });
    expect(delta).toBe(137.11);
    expect(
      computeDoctorCompensationBreakEvenPercent({
        netCompanyDifferenceBeforeDoctorCompensationEuro: delta,
        doctorCompensationBaseReductionEuro: 370,
      }),
    ).toBeUndefined();
  });

  it("delta netto zero → no break-even", () => {
    const delta = computeNetCompanyDifferenceBeforeDoctorCompensation({
      standardNetToCompanyEuro: 4662.89,
      zeroRateNetToCompanyEuro: 4662.89,
    });
    expect(delta).toBe(0);
    expect(
      computeDoctorCompensationBreakEvenPercent({
        netCompanyDifferenceBeforeDoctorCompensationEuro: delta,
        doctorCompensationBaseReductionEuro: 370,
      }),
    ).toBeUndefined();
  });

  it("nessuno sconto / base reduction = 0 → no divisione per zero", () => {
    expect(
      computeDoctorCompensationBaseReduction({
        originalAmount: 5000,
        discountedAmount: 5000,
      }),
    ).toBe(0);
    expect(
      computeDoctorCompensationBreakEvenPercent({
        netCompanyDifferenceBeforeDoctorCompensationEuro: -32.89,
        doctorCompensationBaseReductionEuro: 0,
      }),
    ).toBeUndefined();
  });

  it("caso reale PCA/NBQ: break-even ≈ 8,89%", () => {
    const delta = computeNetCompanyDifferenceBeforeDoctorCompensation({
      standardNetToCompanyEuro: 4630,
      zeroRateNetToCompanyEuro: 4662.89,
    });
    expect(delta).toBe(-32.89);
    const base = computeDoctorCompensationBaseReduction({
      originalAmount: 5000,
      discountedAmount: 4630,
    });
    expect(base).toBe(370);
    expect(
      computeDoctorCompensationBreakEvenPercent({
        netCompanyDifferenceBeforeDoctorCompensationEuro: delta,
        doctorCompensationBaseReductionEuro: base,
      }),
    ).toBe(8.89);
  });
});
