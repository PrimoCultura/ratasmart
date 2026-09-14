import { describe, expect, it } from "vitest";
import { calculateFinancialSolution } from "../../financial-engine/index.ts";
import {
  buildEconomicsFromSeed2026,
  COMPASS_4CF_DES,
  DB_449,
  DB_SMV,
  DB_ST,
  DB_ZERO,
  HEYLIGHT_TR7,
  HEYLIGHT_TR7_DEALER_COST_BY_DURATION,
} from "../../../convex/lib/desPaoleschi2026Data.ts";
import {
  DES_ALLOWED_TABLE_CODES,
  isCompanyAvailableOnNetwork,
  isTableAvailableOnNetwork,
  PAOLESCHI_ALLOWED_TABLE_CODES,
} from "../des-paoleschi-2026.ts";
import { evaluateSmvSeniorAge } from "../../policy-engine/smv-senior-age.ts";
import { buildComparisonResult } from "../../policy-engine/comparison.ts";
import type { RuntimeFinancialTable } from "../../policy-engine/comparison.ts";

function tableFromSeed(
  seed: typeof COMPASS_4CF_DES,
  network: "PCG" | "DES" | "Paoleschi",
  id: string,
): RuntimeFinancialTable {
  const economics = buildEconomicsFromSeed2026(seed);
  return {
    id,
    companyId: `c-${seed.companyShortName}`,
    productId: `p-${seed.productCode}`,
    network,
    tableCode: seed.tableCode,
    displayName: seed.displayName,
    category: seed.category,
    version: 1,
    ...economics,
    isActive: true,
  };
}

describe("DES/Paoleschi 2026 financial config", () => {
  it("Compass 4CF DES: TAN/opening/collection/durate da 81K", () => {
    const economics = buildEconomicsFromSeed2026(COMPASS_4CF_DES);
    expect(economics.customerTanPercent).toBe(10.75);
    expect(economics.minimumAmount).toBe(1000);
    expect(economics.maximumAmount).toBe(30000);
    expect(economics.minimumDurationMonths).toBe(12);
    expect(economics.maximumDurationMonths).toBe(84);
    expect(economics.openingFeeType).toBe("none");
    expect(economics.openingFeeValue).toBe(0);
    expect(economics.collectionFeePerInstallment).toBe(3);
    expect(economics.firstInstallmentDelayDays).toEqual([30]);

    const calc = calculateFinancialSolution({
      requestedAmount: 5000,
      durationMonths: 24,
      customerTanPercent: 10.75,
      openingFeeType: "none",
      openingFeeValue: 0,
      collectionFeePerInstallment: 3,
      installmentFeeType: "fixed",
      installmentFeeValue: 3,
      firstInstallmentDelayDays: 30,
    });
    expect(calc.internalCostAmount).toBe(0);
    expect(calc.openingFeeAmount).toBe(0);
  });

  it("HeyLight costi dealer e totale paziente = finanziato", () => {
    for (const [months, pct] of Object.entries(
      HEYLIGHT_TR7_DEALER_COST_BY_DURATION,
    )) {
      const durationMonths = Number(months);
      const calc = calculateFinancialSolution({
        requestedAmount: 1000,
        durationMonths,
        customerTanPercent: 0,
        openingFeeType: "none",
        openingFeeValue: 0,
        collectionFeePerInstallment: 0,
        installmentFeeType: "none",
        installmentFeeValue: 0,
        internalCostBase: "requested_amount",
        internalCostPercentApplied: pct,
        firstInstallmentDelayDays: 30,
      });
      expect(calc.totalCustomerRepayment).toBeCloseTo(1000, 2);
      expect(calc.internalCostAmount).toBeCloseTo((1000 * pct) / 100, 2);
      expect(calc.netAmountPaidToCompany).toBeCloseTo(
        1000 - calc.internalCostAmount,
        2,
      );
    }

    expect(
      calculateFinancialSolution({
        requestedAmount: 1000,
        durationMonths: 1,
        customerTanPercent: 0,
        openingFeeType: "none",
        openingFeeValue: 0,
        collectionFeePerInstallment: 0,
        installmentFeeType: "none",
        installmentFeeValue: 0,
        internalCostBase: "requested_amount",
        internalCostPercentApplied: 4.628,
        firstInstallmentDelayDays: 30,
      }).internalCostAmount,
    ).toBeCloseTo(46.28, 2);

    expect(
      calculateFinancialSolution({
        requestedAmount: 1000,
        durationMonths: 6,
        customerTanPercent: 0,
        openingFeeType: "none",
        openingFeeValue: 0,
        collectionFeePerInstallment: 0,
        installmentFeeType: "none",
        installmentFeeValue: 0,
        internalCostBase: "requested_amount",
        internalCostPercentApplied: 6.438,
        firstInstallmentDelayDays: 30,
      }).internalCostAmount,
    ).toBeCloseTo(64.38, 2);

    expect(
      calculateFinancialSolution({
        requestedAmount: 1000,
        durationMonths: 12,
        customerTanPercent: 0,
        openingFeeType: "none",
        openingFeeValue: 0,
        collectionFeePerInstallment: 0,
        installmentFeeType: "none",
        installmentFeeValue: 0,
        internalCostBase: "requested_amount",
        internalCostPercentApplied: 8.458,
        firstInstallmentDelayDays: 30,
      }).internalCostAmount,
    ).toBeCloseTo(84.58, 2);
  });

  it("HeyLight range importo e assenza Paoleschi", () => {
    const economics = buildEconomicsFromSeed2026(HEYLIGHT_TR7);
    expect(economics.minimumAmount).toBe(300);
    expect(economics.maximumAmount).toBe(3000);
    expect(HEYLIGHT_TR7.category).toBe("bnpl");
    expect(HEYLIGHT_TR7.networks).toEqual(["PCG", "DES"]);
    expect(
      isTableAvailableOnNetwork({
        network: "Paoleschi",
        companyShortName: "HeyLight",
        tableCode: "TR7",
      }),
    ).toBe(false);
  });

  it("DB ST: provvigione attiva 2% senza alterare totale paziente", () => {
    const calc = calculateFinancialSolution({
      requestedAmount: 5000,
      durationMonths: 24,
      customerTanPercent: 9.95,
      openingFeeType: "none",
      openingFeeValue: 0,
      collectionFeePerInstallment: 3,
      installmentFeeType: "fixed",
      installmentFeeValue: 3,
      activeCommissionPercent: 2,
      activeCommissionBase: "requested_amount",
      firstInstallmentDelayDays: 30,
    });
    expect(calc.activeCommissionAmount).toBe(100);
    expect(calc.internalCostAmount).toBe(0);
    expect(calc.companyEconomicValue).toBe(
      calc.netAmountPaidToCompany + 100,
    );
    const withoutCommission = calculateFinancialSolution({
      requestedAmount: 5000,
      durationMonths: 24,
      customerTanPercent: 9.95,
      openingFeeType: "none",
      openingFeeValue: 0,
      collectionFeePerInstallment: 3,
      installmentFeeType: "fixed",
      installmentFeeValue: 3,
      firstInstallmentDelayDays: 30,
    });
    expect(calc.totalCustomerRepayment).toBe(
      withoutCommission.totalCustomerRepayment,
    );
  });

  it("DB 4,49: company cost 4% e sole durate 12/18/24/36/48", () => {
    const economics = buildEconomicsFromSeed2026(DB_449);
    expect(economics.customerTanPercent).toBe(4.49);
    expect(economics.durationTerms?.map((t) => t.durationMonths)).toEqual([
      12, 18, 24, 36, 48,
    ]);
    const calc = calculateFinancialSolution({
      requestedAmount: 5000,
      durationMonths: 24,
      customerTanPercent: 4.49,
      openingFeeType: "none",
      openingFeeValue: 0,
      collectionFeePerInstallment: 3,
      installmentFeeType: "fixed",
      installmentFeeValue: 3,
      internalCostBase: "requested_amount",
      internalCostPercentApplied: 4,
      firstInstallmentDelayDays: 30,
    });
    expect(calc.internalCostAmount).toBe(200);
  });

  it("DB Zero: costi 4.5 / 6.75 / 9", () => {
    const cases = [
      [12, 225],
      [18, 337.5],
      [24, 450],
    ] as const;
    for (const [months, cost] of cases) {
      const term = DB_ZERO.durationTerms!.find(
        (item) => item.durationMonths === months,
      );
      expect(term?.internalCostPercent).toBeDefined();
      const calc = calculateFinancialSolution({
        requestedAmount: 5000,
        durationMonths: months,
        customerTanPercent: 0,
        openingFeeType: "none",
        openingFeeValue: 0,
        collectionFeePerInstallment: 3,
        installmentFeeType: "fixed",
        installmentFeeValue: 3,
        internalCostBase: "requested_amount",
        internalCostPercentApplied: term!.internalCostPercent,
        firstInstallmentDelayDays: 30,
      });
      expect(calc.internalCostAmount).toBeCloseTo(cost, 2);
    }
  });

  it("SMV: range importo/durate/TAN/opening", () => {
    const economics = buildEconomicsFromSeed2026(DB_SMV);
    expect(economics.customerTanPercent).toBe(12);
    expect(economics.openingFeeType).toBe("percentage");
    expect(economics.openingFeeValue).toBe(2.5);
    expect(economics.durationTerms?.map((t) => t.durationMonths)).toEqual([
      30, 36,
    ]);
    expect(economics.minimumAmount).toBe(3000);
    expect(economics.maximumAmount).toBe(4870);
  });

  it("SMV età: richiede birthDate; senza → verification_required", () => {
    const asOf = Date.UTC(2026, 5, 15);
    expect(
      evaluateSmvSeniorAge({
        age: 77,
        birthDate: "1948-12-14",
        calculationDate: asOf,
      }).status,
    ).toBe("passed");
    expect(
      evaluateSmvSeniorAge({
        age: 77,
        birthDate: "1949-01-01",
        calculationDate: asOf,
      }).status,
    ).toBe("failed");
    expect(
      evaluateSmvSeniorAge({ age: 77, calculationDate: asOf }).status,
    ).toBe("verification_required");
    expect(
      evaluateSmvSeniorAge({ age: 80, calculationDate: asOf }).status,
    ).toBe("verification_required");
    expect(
      evaluateSmvSeniorAge({ age: 86, calculationDate: asOf }).status,
    ).toBe("verification_required");
  });

  it("availability DES/Paoleschi", () => {
    expect([...DES_ALLOWED_TABLE_CODES].sort()).toEqual(
      ["4CF", "DB_449", "DB_ST", "DB_ZERO", "SMV", "TR7"].sort(),
    );
    expect([...PAOLESCHI_ALLOWED_TABLE_CODES].sort()).toEqual(
      ["DB_449", "DB_ST", "DB_ZERO", "SMV"].sort(),
    );
    expect(
      isCompanyAvailableOnNetwork({
        network: "DES",
        companyShortName: "Agos",
      }),
    ).toBe(false);
    expect(
      isCompanyAvailableOnNetwork({
        network: "Paoleschi",
        companyShortName: "Compass",
      }),
    ).toBe(false);
    expect(
      isTableAvailableOnNetwork({
        network: "Paoleschi",
        companyShortName: "Deutsche Bank",
        tableCode: "DB_ST",
      }),
    ).toBe(true);
  });

  it("HeyLight bnpl non è reference zero-interest", () => {
    const tables = [
      tableFromSeed(HEYLIGHT_TR7, "DES", "t-hl"),
      tableFromSeed(DB_ZERO, "DES", "t-zero"),
      tableFromSeed(DB_ST, "DES", "t-st"),
    ];
    const result = buildComparisonResult({
      simulationId: "sim",
      network: "DES",
      calculationDate: Date.UTC(2026, 5, 1),
      patient: {
        age: 45,
        employmentType: "permanent_employee",
        isNonEuCitizen: false,
        employmentSeniorityMonths: 24,
      },
      requestedAmount: 2000,
      selectedDurationMonths: 12,
      selectedFirstInstallmentDelayDays: 30,
      companies: [
        {
          id: "c-HeyLight",
          name: "HeyLight",
          shortName: "HeyLight",
          isActive: true,
        },
        {
          id: "c-Deutsche Bank",
          name: "Deutsche Bank",
          shortName: "Deutsche Bank",
          isActive: true,
        },
      ],
      products: [
        {
          id: "p-TR7",
          companyId: "c-HeyLight",
          name: "TR7",
          code: "TR7",
          isActive: true,
        },
        {
          id: "p-DB_ZERO",
          companyId: "c-Deutsche Bank",
          name: "DB Zero",
          code: "DB_ZERO",
          isActive: true,
        },
        {
          id: "p-DB_ST",
          companyId: "c-Deutsche Bank",
          name: "DB ST",
          code: "DB_ST",
          isActive: true,
        },
      ],
      tables,
      rulesByTableId: {},
      priorities: [],
      internalMessages: [],
    });

    const zeroRefs = result.compatibleSolutions.filter(
      (item) => item.category === "zero_interest",
    );
    expect(zeroRefs.every((item) => item.tableCode === "DB_ZERO")).toBe(true);
    expect(
      result.compatibleSolutions.some((item) => item.category === "bnpl"),
    ).toBe(true);
    expect(
      result.compatibleSolutions.some((item) => item.tableCode === "TR7"),
    ).toBe(true);
  });
});
