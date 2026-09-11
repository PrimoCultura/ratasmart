import { describe, expect, it } from "vitest";
import {
  AGOS_PCG_TABLES,
  buildTableEconomicsFromSeed,
} from "../../../convex/lib/agosPcg2026Data.ts";
import {
  buildComparisonResult,
  type RuntimeFinancialTable,
} from "../comparison.ts";

function seedToRuntime(
  tableCode: string,
  id = `t-${tableCode}`,
): RuntimeFinancialTable {
  const seed = AGOS_PCG_TABLES.find((item) => item.tableCode === tableCode);
  if (!seed) {
    throw new Error(`Seed ${tableCode} non trovato`);
  }
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

function compare(input: {
  tables: RuntimeFinancialTable[];
  requestedAmount: number;
  durationMonths: number;
  delayDays: number;
}) {
  return buildComparisonResult({
    simulationId: "sim-agos",
    network: "PCG",
    calculationDate: new Date(2026, 0, 15).getTime(),
    patient: {
      age: 40,
      employmentType: "permanent_employee",
      isNonEuCitizen: false,
    },
    requestedAmount: input.requestedAmount,
    selectedDurationMonths: input.durationMonths,
    selectedFirstInstallmentDelayDays: input.delayDays,
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

describe("Agos PCG durationTerms – NBQ", () => {
  const nbq = seedToRuntime("NBQ");

  it("€800 a 12 mesi → non disponibile per minimo importo", () => {
    const result = compare({
      tables: [nbq],
      requestedAmount: 800,
      durationMonths: 12,
      delayDays: 30,
    });
    const solution = findByCode(result, "NBQ");
    expect(solution?.compatibility.status).toBe("not_compatible");
    expect(solution?.technicalExclusionReasons.join(" ")).toMatch(/minimo/i);
  });

  it("€1.000 a 12 mesi → disponibile", () => {
    const result = compare({
      tables: [nbq],
      requestedAmount: 1000,
      durationMonths: 12,
      delayDays: 30,
    });
    const solution = findByCode(result, "NBQ");
    expect(solution?.compatibility.status).toBe("compatible");
    expect(solution?.calculation).not.toBeNull();
  });

  it("60 mesi → non disponibile", () => {
    const result = compare({
      tables: [nbq],
      requestedAmount: 1000,
      durationMonths: 60,
      delayDays: 30,
    });
    const solution = findByCode(result, "NBQ");
    expect(solution?.compatibility.status).toBe("not_compatible");
    expect(solution?.technicalExclusionReasons.join(" ")).toMatch(/Durata/i);
  });
});

describe("Agos PCG durationTerms – NBS", () => {
  const nbs = seedToRuntime("NBS");

  it("60 giorni accettato; 30 giorni non previsto", () => {
    const ok = compare({
      tables: [nbs],
      requestedAmount: 1000,
      durationMonths: 24,
      delayDays: 60,
    });
    expect(findByCode(ok, "NBS")?.compatibility.status).toBe("compatible");

    const bad = compare({
      tables: [nbs],
      requestedAmount: 1000,
      durationMonths: 24,
      delayDays: 30,
    });
    expect(findByCode(bad, "NBS")?.compatibility.status).toBe("not_compatible");
    expect(findByCode(bad, "NBS")?.technicalExclusionReasons.join(" ")).toMatch(
      /30 giorni/i,
    );
  });

  it("48 mesi disponibile; 60 mesi escluso", () => {
    const ok = compare({
      tables: [nbs],
      requestedAmount: 1000,
      durationMonths: 48,
      delayDays: 60,
    });
    expect(findByCode(ok, "NBS")?.compatibility.status).toBe("compatible");

    const bad = compare({
      tables: [nbs],
      requestedAmount: 1000,
      durationMonths: 60,
      delayDays: 60,
    });
    expect(findByCode(bad, "NBS")?.compatibility.status).toBe("not_compatible");
  });
});

describe("Agos PCG durationTerms – PR3", () => {
  const pr3 = seedToRuntime("PR3");

  it("€210 a 12 mesi → disponibile", () => {
    const result = compare({
      tables: [pr3],
      requestedAmount: 210,
      durationMonths: 12,
      delayDays: 30,
    });
    expect(findByCode(result, "PR3")?.compatibility.status).toBe("compatible");
  });

  it("€210 a 15 mesi → escluso", () => {
    const result = compare({
      tables: [pr3],
      requestedAmount: 210,
      durationMonths: 15,
      delayDays: 30,
    });
    expect(findByCode(result, "PR3")?.compatibility.status).toBe(
      "not_compatible",
    );
  });

  it("€300 a 20 mesi → disponibile", () => {
    const result = compare({
      tables: [pr3],
      requestedAmount: 300,
      durationMonths: 20,
      delayDays: 30,
    });
    expect(findByCode(result, "PR3")?.compatibility.status).toBe("compatible");
  });
});

describe("Agos PCG durationTerms – PCA", () => {
  const pca = seedToRuntime("PCA");

  it("su €3.000: costi esatti 4,44% / 6,61%; niente oltre 18; >5.000 escluso", () => {
    const at12 = compare({
      tables: [pca],
      requestedAmount: 3000,
      durationMonths: 12,
      delayDays: 30,
    });
    const s12 = findByCode(at12, "PCA");
    expect(s12?.compatibility.status).toBe("compatible");
    expect(s12?.calculation?.internalCostPercentApplied).toBeCloseTo(4.44, 5);
    // non proporzionale da 24: 4.44 != 4.44*(12/24) con base diversa
    expect(s12?.calculation?.internalCostPercentApplied).not.toBeCloseTo(
      3.05 * (12 / 24),
      2,
    );

    const at18 = compare({
      tables: [pca],
      requestedAmount: 3000,
      durationMonths: 18,
      delayDays: 30,
    });
    expect(
      findByCode(at18, "PCA")?.calculation?.internalCostPercentApplied,
    ).toBeCloseTo(6.61, 5);

    const at24 = compare({
      tables: [pca],
      requestedAmount: 3000,
      durationMonths: 24,
      delayDays: 30,
    });
    expect(findByCode(at24, "PCA")?.compatibility.status).toBe("not_compatible");

    const tooHigh = compare({
      tables: [pca],
      requestedAmount: 5001,
      durationMonths: 12,
      delayDays: 30,
    });
    expect(findByCode(tooHigh, "PCA")?.compatibility.status).toBe(
      "not_compatible",
    );
  });
});

describe("Agos PCG durationTerms – PCJ", () => {
  const pcj = seedToRuntime("PCJ");

  it("costi 5,22% / 7,33% e prima rata 60 giorni", () => {
    const at12 = compare({
      tables: [pcj],
      requestedAmount: 3000,
      durationMonths: 12,
      delayDays: 60,
    });
    expect(
      findByCode(at12, "PCJ")?.calculation?.internalCostPercentApplied,
    ).toBeCloseTo(5.22, 5);

    const at18 = compare({
      tables: [pcj],
      requestedAmount: 3000,
      durationMonths: 18,
      delayDays: 60,
    });
    expect(
      findByCode(at18, "PCJ")?.calculation?.internalCostPercentApplied,
    ).toBeCloseTo(7.33, 5);

    const delay30 = compare({
      tables: [pcj],
      requestedAmount: 3000,
      durationMonths: 12,
      delayDays: 30,
    });
    expect(findByCode(delay30, "PCJ")?.compatibility.status).toBe(
      "not_compatible",
    );
  });
});

describe("Agos PCG durationTerms – PV2", () => {
  const pv2 = seedToRuntime("PV2");

  it("verifica costi esatti e NON proporzionali dal 24 mesi", () => {
    const expected: Record<number, number> = {
      12: 1.6,
      18: 2.35,
      24: 3.05,
      36: 4.8,
    };

    for (const [months, cost] of Object.entries(expected)) {
      const duration = Number(months);
      const result = compare({
        tables: [pv2],
        requestedAmount: 3000,
        durationMonths: duration,
        delayDays: 30,
      });
      const solution = findByCode(result, "PV2");
      expect(solution?.compatibility.status).toBe("compatible");
      expect(solution?.calculation?.internalCostPercentApplied).toBeCloseTo(
        cost,
        5,
      );
      // se fosse proporzionale da 3.05@24: 12→1.525, 18→2.2875, 36→4.575
      const proportional = 3.05 * (duration / 24);
      if (duration !== 24) {
        expect(solution?.calculation?.internalCostPercentApplied).not.toBeCloseTo(
          proportional,
          2,
        );
      }
    }
  });
});

describe("Agos PCG – Agos Pass 3–12 mesi", () => {
  it("€1.200 / 12 mesi: TAN 10,50%, fee 0, costo 0, piano chiude a zero", () => {
    const pass = seedToRuntime("AGOS_PASS_12");
    const result = compare({
      tables: [pass],
      requestedAmount: 1200,
      durationMonths: 12,
      delayDays: 30,
    });
    const solution = findByCode(result, "AGOS_PASS_12");
    expect(solution?.compatibility.status).toBe("compatible");
    expect(solution?.calculation?.customerTanPercent).toBe(10.5);
    expect(solution?.calculation?.openingFeeAmount).toBe(0);
    expect(solution?.calculation?.collectionFeePerInstallment).toBe(0);
    expect(solution?.calculation?.internalCostAmount).toBe(0);
    expect(solution?.calculation?.amortizationSchedule.at(-1)?.closingBalance).toBe(
      0,
    );
  });

  it.each([3, 4, 6, 11, 12])("durata %s mesi ammessa", (durationMonths) => {
    const pass = seedToRuntime("AGOS_PASS_12");
    const result = compare({
      tables: [pass],
      requestedAmount: 1000,
      durationMonths,
      delayDays: 30,
    });
    const solution = findByCode(result, "AGOS_PASS_12");
    expect(solution?.compatibility.status).toBe("compatible");
    expect(solution?.technicalExclusionReasons).toEqual([]);
  });

  it.each([2, 13])("durata %s mesi esclusa", (durationMonths) => {
    const pass = seedToRuntime("AGOS_PASS_12");
    const result = compare({
      tables: [pass],
      requestedAmount: 1000,
      durationMonths,
      delayDays: 30,
    });
    const solution = findByCode(result, "AGOS_PASS_12");
    expect(solution?.technicalExclusionReasons.length).toBeGreaterThan(0);
  });
});

describe("Scenari manuali Agos PCG", () => {
  const tables = [
    seedToRuntime("NBQ"),
    seedToRuntime("NBS"),
    seedToRuntime("PR3"),
    seedToRuntime("PCA"),
    seedToRuntime("PCJ"),
    seedToRuntime("PV2"),
    seedToRuntime("AGOS_PASS_12"),
  ];

  it("Scenario 1: €1000 / 12m / 30gg → NBQ+PR3; non PCA/PV2", () => {
    const result = compare({
      tables,
      requestedAmount: 1000,
      durationMonths: 12,
      delayDays: 30,
    });
    const codes = result.compatibleSolutions.map((s) => s.tableCode).sort();
    expect(codes).toContain("NBQ");
    expect(codes).toContain("PR3");
    expect(codes).not.toContain("PCA");
    expect(codes).not.toContain("PV2");
  });

  it("Scenario 2: €3000 / 18m / 30gg → NBQ, PCA, PV2", () => {
    const result = compare({
      tables,
      requestedAmount: 3000,
      durationMonths: 18,
      delayDays: 30,
    });
    const codes = result.compatibleSolutions.map((s) => s.tableCode);
    expect(codes).toContain("NBQ");
    expect(codes).toContain("PCA");
    expect(codes).toContain("PV2");
  });

  it("Scenario 3: €3000 / 18m / 60gg → NBS, PCJ", () => {
    const result = compare({
      tables,
      requestedAmount: 3000,
      durationMonths: 18,
      delayDays: 60,
    });
    const codes = result.compatibleSolutions.map((s) => s.tableCode);
    expect(codes).toContain("NBS");
    expect(codes).toContain("PCJ");
  });
});
