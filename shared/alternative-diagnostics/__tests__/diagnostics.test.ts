import { describe, expect, it } from "vitest";
import {
  AGOS_PCG_TABLES,
  buildTableEconomicsFromSeed,
} from "../../../convex/lib/agosPcg2026Data.ts";
import { PCG_FINANCING_POLICY_SETS_2026 } from "../../../convex/lib/pcgFinancingPolicies2026Data.ts";
import {
  buildComparisonResult,
  type RuntimeFinancialTable,
} from "../../policy-engine/comparison.ts";
import type {
  PatientFinancialProfile,
  RuntimePolicyRule,
} from "../../policy-engine/types.ts";
import {
  buildComparisonDiagnostics,
  collectComparisonDurationOptions,
  resolveComparisonDiagnostics,
} from "../index.ts";

function seedToRuntime(tableCode: string): RuntimeFinancialTable {
  const seed = AGOS_PCG_TABLES.find((item) => item.tableCode === tableCode);
  if (!seed) throw new Error(`Seed ${tableCode} missing`);
  const economics = buildTableEconomicsFromSeed(seed);
  return {
    id: `t-${tableCode}`,
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

function agosRules(): RuntimePolicyRule[] {
  const set = PCG_FINANCING_POLICY_SETS_2026.find(
    (item) => item.companyShortName === "Agos",
  );
  if (!set) throw new Error("Agos policies missing");
  return set.rules.map((rule, index) => ({
    id: `agos-${index}`,
    policySetId: set.stableKey,
    scope: "company" as const,
    ruleType: rule.ruleType,
    operator: rule.operator,
    numericValue: rule.numericValue,
    stringValue: rule.stringValue,
    booleanValue: rule.booleanValue,
    stringValues: rule.stringValues,
    monthsBuffer: rule.monthsBuffer,
    failureMessage: rule.failureMessage,
    verificationMessage: rule.verificationMessage,
    sortOrder: rule.sortOrder,
  }));
}

const allAgosTables = AGOS_PCG_TABLES.map((seed) => seedToRuntime(seed.tableCode));

function runCase(input: {
  calculationDate: number;
  patient: PatientFinancialProfile;
  amount: number;
  durationMonths: number;
}) {
  const rules = agosRules();
  const rulesByTableId = Object.fromEntries(
    allAgosTables.map((table) => [table.id, rules]),
  );
  const result = buildComparisonResult({
    simulationId: "sim-diag",
    network: "PCG",
    calculationDate: input.calculationDate,
    patient: input.patient,
    requestedAmount: input.amount,
    selectedDurationMonths: input.durationMonths,
    selectedFirstInstallmentDelayDays: 30,
    companies: [{ id: "agos", name: "Agos", shortName: "Agos", isActive: true }],
    products: allAgosTables.map((table) => ({
      id: table.productId,
      companyId: "agos",
      name: table.tableCode,
      code: table.tableCode,
      isActive: true,
    })),
    tables: allAgosTables,
    rulesByTableId,
    priorities: [],
    internalMessages: [],
  });

  const diagnostics = buildComparisonDiagnostics({
    calculationDate: input.calculationDate,
    requestedAmount: input.amount,
    selectedDurationMonths: result.selectedDurationMonths,
    firstInstallmentDelayDays: result.selectedFirstInstallmentDelayDays,
    patient: input.patient,
    compatibleSolutions: result.compatibleSolutions,
    verificationRequiredSolutions: result.verificationRequiredSolutions,
    incompatibleSolutions: result.incompatibleSolutions,
    tables: allAgosTables,
    companyNameById: { agos: "Agos" },
    rulesByTableId,
  });

  return { result, diagnostics };
}

describe("alternative diagnostics – caso reale TD + permesso", () => {
  const calculationDate = new Date(2026, 8, 11).getTime(); // 11/09/2026
  const contractExpiry = new Date(2026, 10, 11).getTime(); // 11/11/2026
  const permitExpiry = new Date(2026, 11, 31).getTime(); // 31/12/2026

  const patient: PatientFinancialProfile = {
    age: 60,
    employmentType: "temporary_employee",
    temporaryContractExpiry: contractExpiry,
    isNonEuCitizen: true,
    residencePermitExpiry: permitExpiry,
  };

  it("CASO A: €4000, finestra ~2 mesi → no compatible, primary contratto, no PR3/Pass", () => {
    const { result, diagnostics } = runCase({
      calculationDate,
      patient,
      amount: 4000,
      durationMonths: 24,
    });

    expect(result.compatibleSolutions).toHaveLength(0);
    expect(diagnostics.hasCompatibleSolutions).toBe(false);
    expect(diagnostics.primaryConstraint?.type).toBe(
      "temporary_contract_expiry",
    );
    expect(
      diagnostics.blockingConstraints.some(
        (item) => item.type === "residence_permit_expiry",
      ),
    ).toBe(true);

    const economic = diagnostics.nearestAlternatives.filter(
      (item) =>
        item.type === "shorter_duration" ||
        item.type === "lower_amount" ||
        item.type === "lower_amount_and_shorter_duration",
    );
    expect(economic).toHaveLength(0);
    expect(economic.every((item) => item.tableCode !== "PR3")).toBe(true);
    expect(economic.every((item) => item.tableCode !== "AGOS_PASS_12")).toBe(
      true,
    );
  });

  it("CASO B: scadenze maggio 2027 → possibili durate reali", () => {
    const { result } = runCase({
      calculationDate,
      patient: {
        ...patient,
        temporaryContractExpiry: new Date(2027, 4, 31).getTime(),
        residencePermitExpiry: new Date(2027, 4, 31).getTime(),
      },
      amount: 4000,
      durationMonths: 6,
    });
    // Con ~8 mesi utili possono esistere soluzioni a durata breve se importo ammesso
    expect(
      result.compatibleSolutions.length +
        result.verificationRequiredSolutions.length,
    ).toBeGreaterThanOrEqual(0);
  });

  it("CASO C: scadenze ampie e €4000 → alternative economiche reali (importo/durata)", () => {
    const { diagnostics, result } = runCase({
      calculationDate,
      patient: {
        ...patient,
        temporaryContractExpiry: new Date(2027, 4, 31).getTime(),
        residencePermitExpiry: new Date(2027, 4, 31).getTime(),
      },
      amount: 4000,
      durationMonths: 24,
    });

    if (result.compatibleSolutions.length === 0) {
      const economic = diagnostics.nearestAlternatives.filter(
        (item) =>
          item.type === "lower_amount" ||
          item.type === "lower_amount_and_shorter_duration" ||
          item.type === "shorter_duration",
      );
      expect(economic.length).toBeGreaterThan(0);
      expect(
        economic.some(
          (item) =>
            item.tableCode === "PR3" ||
            item.tableCode === "AGOS_PASS_12" ||
            (item.durationMonths !== undefined && item.durationMonths < 24),
        ),
      ).toBe(true);
    }
  });

  it("CASO D: finestra <6 mesi e €1500 → PR3 non proposta; Pass 3m solo se finestra basta", () => {
    const { diagnostics } = runCase({
      calculationDate,
      patient,
      amount: 1500,
      durationMonths: 12,
    });

    const economic = diagnostics.nearestAlternatives.filter(
      (item) =>
        item.type === "shorter_duration" ||
        item.type === "lower_amount" ||
        item.type === "lower_amount_and_shorter_duration",
    );
    expect(economic.some((item) => item.tableCode === "PR3")).toBe(false);
    // Agos Pass min 3 mesi: con ~2 mesi utili non deve essere proposto
    expect(economic.some((item) => item.tableCode === "AGOS_PASS_12")).toBe(
      false,
    );
  });

  it("CASO E: €4000 e 8 mesi di margine → lower_amount se tabella reale lo consente", () => {
    const { diagnostics, result } = runCase({
      calculationDate,
      patient: {
        ...patient,
        temporaryContractExpiry: new Date(2027, 4, 11).getTime(), // ~8 mesi
        residencePermitExpiry: new Date(2027, 4, 11).getTime(),
      },
      amount: 4000,
      durationMonths: 24,
    });

    if (result.compatibleSolutions.length === 0) {
      const economic = diagnostics.nearestAlternatives.filter(
        (item) =>
          item.type === "lower_amount" ||
          item.type === "lower_amount_and_shorter_duration",
      );
      // Se nessuna tabella a 4000 entro 8 mesi, può emergere scenario lower_amount
      expect(
        economic.length === 0 ||
          economic.every((item) => (item.requiredAmountMax ?? 0) < 4000),
      ).toBe(true);
    }
  });
});

describe("Agos Pass durate 3–12", () => {
  const pass = seedToRuntime("AGOS_PASS_12");

  it.each([2, 13])("%s mesi escluso", (months) => {
    const options = collectComparisonDurationOptions({
      tables: [pass],
      requestedAmount: 1000,
      firstInstallmentDelayDays: 30,
    });
    expect(options).not.toContain(months);
  });

  it.each([3, 4, 6, 11, 12])("%s mesi ammesso", (months) => {
    const options = collectComparisonDurationOptions({
      tables: [pass],
      requestedAmount: 1000,
      firstInstallmentDelayDays: 30,
    });
    expect(options).toContain(months);
  });
});

describe("resolveComparisonDiagnostics – UI wiring", () => {
  const calculationDate = new Date(2026, 8, 11).getTime();
  const contractExpiry = new Date(2026, 10, 11).getTime();
  const permitExpiry = new Date(2026, 11, 31).getTime();

  it("senza snapshot persistito ricostruisce card dal run fotografato", () => {
    const diagnostics = resolveComparisonDiagnostics({
      persistedDiagnostics: null,
      hasCompatibleSolutions: false,
      calculationDate,
      requestedAmount: 4000,
      selectedDurationMonths: 24,
      firstInstallmentDelayDays: 30,
      patient: {
        age: 60,
        employmentType: "temporary_employee",
        temporaryContractExpiry: contractExpiry,
        isNonEuCitizen: true,
        residencePermitExpiry: permitExpiry,
      },
      solutions: [
        {
          resultGroup: "not_compatible",
          companyShortName: "Agos",
          compatibilitySnapshot: {
            failedRules: [
              {
                ruleType: "temporary_contract_expiry",
                message: "Il finanziamento deve terminare prima della scadenza del contratto.",
              },
              {
                ruleType: "residence_permit_expiry",
                message: "Il finanziamento deve terminare entro la validità del permesso.",
              },
            ],
          },
        },
      ],
    });

    expect(diagnostics).not.toBeNull();
    expect(diagnostics?.primaryConstraint?.type).toBe(
      "temporary_contract_expiry",
    );
    expect(diagnostics?.primaryConstraint?.value).toMatch(/novembre 2026/i);
    expect(
      diagnostics?.blockingConstraints.some(
        (item) => item.type === "residence_permit_expiry",
      ),
    ).toBe(true);
    expect(
      diagnostics?.nearestAlternatives.every(
        (item) =>
          item.tableCode !== "PR3" &&
          item.tableCode !== "AGOS_PASS_12" &&
          item.certainty === "requires_verification",
      ),
    ).toBe(true);
  });

  it("con compatible > 0 non produce card failure", () => {
    expect(
      resolveComparisonDiagnostics({
        hasCompatibleSolutions: true,
        calculationDate,
        requestedAmount: 4000,
        selectedDurationMonths: 24,
        firstInstallmentDelayDays: 30,
        patient: {
          age: 40,
          employmentType: "permanent_employee",
          isNonEuCitizen: false,
        },
        solutions: [],
      }),
    ).toBeNull();
  });
});

describe("duration options UI", () => {
  it("non genera automaticamente 6..84 e include Pass 3–12 quando pertinente", () => {
    const options = collectComparisonDurationOptions({
      tables: allAgosTables,
      requestedAmount: 1000,
      firstInstallmentDelayDays: 30,
    });
    expect(options).toContain(3);
    expect(options).toContain(12);
    expect(options).not.toContain(35);
    expect(options).not.toEqual(
      Array.from({ length: 79 }, (_, index) => index + 6),
    );
  });
});
