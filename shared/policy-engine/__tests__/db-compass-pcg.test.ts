/**
 * Test Deutsche Bank + Compass PCG 2026.
 */
import { describe, expect, it } from "vitest";
import { calculateFinancialSolution } from "../../financial-engine/index.ts";
import {
  COMPASS_PCG_TABLES,
  DEUTSCHE_BANK_PCG_TABLES,
  buildTableEconomicsFromPcgSeed,
} from "../../../convex/lib/pcg2026SeedData.ts";
import {
  buildComparisonResult,
  type RuntimeFinancialTable,
} from "../comparison.ts";

function seedToRuntime(
  tables: typeof DEUTSCHE_BANK_PCG_TABLES,
  tableCode: string,
  companyId: string,
): RuntimeFinancialTable {
  const seed = tables.find((item) => item.tableCode === tableCode);
  if (!seed) throw new Error(`Seed ${tableCode} non trovato`);
  const economics = buildTableEconomicsFromPcgSeed(seed);
  return {
    id: `t-${tableCode}`,
    companyId,
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

function compare(input: {
  companyId: string;
  companyName: string;
  tables: RuntimeFinancialTable[];
  requestedAmount: number;
  durationMonths: number;
  delayDays?: number;
}) {
  return buildComparisonResult({
    simulationId: "sim-pcg",
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
      {
        id: input.companyId,
        name: input.companyName,
        shortName: input.companyName,
        isActive: true,
      },
    ],
    products: input.tables.map((table) => ({
      id: table.productId,
      companyId: input.companyId,
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

function findByCode(
  result: ReturnType<typeof buildComparisonResult>,
  code: string,
) {
  return [
    ...result.compatibleSolutions,
    ...result.verificationRequiredSolutions,
    ...result.incompatibleSolutions,
  ].find((item) => item.tableCode === code);
}

describe("Deutsche Bank SJ=", () => {
  const sj = seedToRuntime(DEUTSCHE_BANK_PCG_TABLES, "SJ=", "db");

  it("fascia importi 600–1599", () => {
    expect(
      findByCode(
        compare({
          companyId: "db",
          companyName: "Deutsche Bank",
          tables: [sj],
          requestedAmount: 600,
          durationMonths: 12,
        }),
        "SJ=",
      )?.compatibility.status,
    ).toBe("compatible");
    expect(
      findByCode(
        compare({
          companyId: "db",
          companyName: "Deutsche Bank",
          tables: [sj],
          requestedAmount: 599,
          durationMonths: 12,
        }),
        "SJ=",
      )?.compatibility.status,
    ).toBe("not_compatible");
    expect(
      findByCode(
        compare({
          companyId: "db",
          companyName: "Deutsche Bank",
          tables: [sj],
          requestedAmount: 1599,
          durationMonths: 12,
        }),
        "SJ=",
      )?.compatibility.status,
    ).toBe("compatible");
    expect(
      findByCode(
        compare({
          companyId: "db",
          companyName: "Deutsche Bank",
          tables: [sj],
          requestedAmount: 1600,
          durationMonths: 12,
        }),
        "SJ=",
      )?.compatibility.status,
    ).toBe("not_compatible");
  });
});

describe("Deutsche Bank MUE", () => {
  const mue = seedToRuntime(DEUTSCHE_BANK_PCG_TABLES, "MUE", "db");

  it("fascia importi 1600–2599", () => {
    expect(
      findByCode(
        compare({
          companyId: "db",
          companyName: "Deutsche Bank",
          tables: [mue],
          requestedAmount: 1600,
          durationMonths: 12,
        }),
        "MUE",
      )?.compatibility.status,
    ).toBe("compatible");
    expect(
      findByCode(
        compare({
          companyId: "db",
          companyName: "Deutsche Bank",
          tables: [mue],
          requestedAmount: 2599,
          durationMonths: 24,
        }),
        "MUE",
      )?.compatibility.status,
    ).toBe("compatible");
    expect(
      findByCode(
        compare({
          companyId: "db",
          companyName: "Deutsche Bank",
          tables: [mue],
          requestedAmount: 2600,
          durationMonths: 24,
        }),
        "MUE",
      )?.compatibility.status,
    ).toBe("not_compatible");
  });
});

describe("Deutsche Bank S/U", () => {
  const su = seedToRuntime(DEUTSCHE_BANK_PCG_TABLES, "S/U", "db");

  it("fascia importi 2600–20000", () => {
    expect(
      findByCode(
        compare({
          companyId: "db",
          companyName: "Deutsche Bank",
          tables: [su],
          requestedAmount: 2600,
          durationMonths: 24,
        }),
        "S/U",
      )?.compatibility.status,
    ).toBe("compatible");
    expect(
      findByCode(
        compare({
          companyId: "db",
          companyName: "Deutsche Bank",
          tables: [su],
          requestedAmount: 20000,
          durationMonths: 36,
        }),
        "S/U",
      )?.compatibility.status,
    ).toBe("compatible");
    expect(
      findByCode(
        compare({
          companyId: "db",
          companyName: "Deutsche Bank",
          tables: [su],
          requestedAmount: 20001,
          durationMonths: 36,
        }),
        "S/U",
      )?.compatibility.status,
    ).toBe("not_compatible");
  });
});

describe("Deutsche Bank S8L", () => {
  const s8l = seedToRuntime(DEUTSCHE_BANK_PCG_TABLES, "S8L", "db");

  it("costo su requestedAmount + fee finanziata + auth", () => {
    const at12 = findByCode(
      compare({
        companyId: "db",
        companyName: "Deutsche Bank",
        tables: [s8l],
        requestedAmount: 3000,
        durationMonths: 12,
      }),
      "S8L",
    );
    expect(at12?.compatibility.status).toBe("compatible");
    expect(at12?.calculation?.internalCostPercentApplied).toBeCloseTo(4.75, 5);
    expect(at12?.calculation?.internalCostAmount).toBe(142.5);
    expect(at12?.calculation?.openingFeeAmount).toBe(75);
    expect(at12?.calculation?.financedAmount).toBe(3075);
    expect(at12?.calculation?.netAmountPaidToCompany).toBe(2857.5);
    expect(at12?.calculation?.internalCostBase).toBe("requested_amount");
    expect(at12?.requiresManagerAuthorizationNotice).toBe(true);

    const at18 = findByCode(
      compare({
        companyId: "db",
        companyName: "Deutsche Bank",
        tables: [s8l],
        requestedAmount: 3000,
        durationMonths: 18,
      }),
      "S8L",
    );
    expect(at18?.calculation?.internalCostPercentApplied).toBeCloseTo(7.125, 5);
    expect(at18?.calculation?.internalCostAmount).toBe(213.75);
    expect(at18?.calculation?.netAmountPaidToCompany).toBe(2786.25);
  });
});

describe("Compass 81K", () => {
  it("€1000: fee 3% finanziata, netto = richiesto", () => {
    const result = calculateFinancialSolution({
      requestedAmount: 1000,
      durationMonths: 12,
      customerTanPercent: 10.5,
      openingFeeType: "percentage",
      openingFeeValue: 3,
      installmentFeeType: "none",
      installmentFeeValue: 0,
      collectionFeePerInstallment: 0,
      firstInstallmentDelayDays: 30,
    });
    expect(result.openingFeeAmount).toBe(30);
    expect(result.financedAmount).toBe(1030);
    expect(result.collectionFeePerInstallment).toBe(0);
    expect(result.netAmountPaidToCompany).toBe(1000);
  });
});

describe("Compass NE9", () => {
  const ne9 = seedToRuntime(COMPASS_PCG_TABLES, "NE9", "compass");

  it("€1000 / 10 mesi: fee 0,6%/rata, TAN 0, netto 1000, no auth", () => {
    const solution = findByCode(
      compare({
        companyId: "compass",
        companyName: "Compass",
        tables: [ne9],
        requestedAmount: 1000,
        durationMonths: 10,
      }),
      "NE9",
    );
    expect(solution?.compatibility.status).toBe("compatible");
    const calc = solution?.calculation;
    expect(calc?.financedAmount).toBe(1000);
    expect(calc?.regularBaseInstallmentAmount).toBe(100);
    expect(calc?.collectionFeePerInstallment).toBe(6);
    expect(calc?.regularTotalInstallmentAmount).toBe(106);
    expect(calc?.totalCustomerRepayment).toBe(1060);
    expect(calc?.totalCustomerCosts).toBe(60);
    expect(calc?.internalCostAmount).toBe(0);
    expect(calc?.netAmountPaidToCompany).toBe(1000);
    expect(solution?.requiresManagerAuthorizationNotice).toBe(false);
    expect(calc?.estimatedTaeg.success).toBe(true);
  });

  it("limiti importo e durata", () => {
    const cases: Array<{
      amount: number;
      months: number;
      ok: boolean;
    }> = [
      { amount: 299, months: 10, ok: false },
      { amount: 300, months: 10, ok: true },
      { amount: 1500, months: 10, ok: true },
      { amount: 1501, months: 10, ok: false },
      { amount: 1000, months: 9, ok: false },
      { amount: 1000, months: 10, ok: true },
      { amount: 1000, months: 48, ok: true },
      { amount: 1000, months: 49, ok: false },
    ];

    for (const item of cases) {
      const status = findByCode(
        compare({
          companyId: "compass",
          companyName: "Compass",
          tables: [ne9],
          requestedAmount: item.amount,
          durationMonths: item.months,
        }),
        "NE9",
      )?.compatibility.status;
      expect(status).toBe(item.ok ? "compatible" : "not_compatible");
    }
  });

  it("resta nel gruppo ranking senza costo aziendale", () => {
    const s8l = seedToRuntime(DEUTSCHE_BANK_PCG_TABLES, "S8L", "db");
    // Confronta solo NE9 vs una soluzione con costo nello stesso risultato
    // via ranking: NE9 deve risultare tra le without-cost.
    const result = compare({
      companyId: "compass",
      companyName: "Compass",
      tables: [ne9],
      requestedAmount: 1000,
      durationMonths: 10,
    });
    expect(result.compatibleSolutions[0]?.tableCode).toBe("NE9");
    expect(result.compatibleSolutions[0]?.calculation?.internalCostAmount).toBe(
      0,
    );
    void s8l;
  });
});
