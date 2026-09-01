/**
 * DEMO TECNICA – NON USARE IN PRODUZIONE
 * Scenari di integrazione del confronto senza condizioni ufficiali.
 */
import { describe, expect, it } from "vitest";
import { buildComparisonResult } from "../comparison.ts";
import type {
  ComparisonBuildInput,
  RuntimeFinancialTable,
} from "../comparison.ts";
import type { RuntimePolicyRule } from "../types.ts";

const DEMO = "DEMO TECNICA – NON USARE IN PRODUZIONE";

function baseTable(
  overrides: Partial<RuntimeFinancialTable> &
    Pick<RuntimeFinancialTable, "id" | "companyId" | "tableCode">,
): RuntimeFinancialTable {
  return {
    id: overrides.id,
    companyId: overrides.companyId,
    productId: overrides.productId ?? `prod-${overrides.companyId}`,
    network: "PCG",
    tableCode: overrides.tableCode,
    displayName: overrides.displayName ?? `${overrides.tableCode} ${DEMO}`,
    category: overrides.category ?? "standard",
    version: 1,
    minimumAmount: overrides.minimumAmount ?? 1000,
    maximumAmount: overrides.maximumAmount ?? 20000,
    minimumDurationMonths: overrides.minimumDurationMonths ?? 12,
    maximumDurationMonths: overrides.maximumDurationMonths ?? 48,
    durationStepMonths: overrides.durationStepMonths ?? 12,
    customerTanPercent: overrides.customerTanPercent ?? 9.9,
    openingFeeType: overrides.openingFeeType ?? "none",
    openingFeeValue: overrides.openingFeeValue ?? 0,
    collectionFeePerInstallment: overrides.collectionFeePerInstallment ?? 0,
    internalCostPercentAt24Months: overrides.internalCostPercentAt24Months,
    firstInstallmentDelayDays: overrides.firstInstallmentDelayDays ?? [30, 60],
    requiresManagerAuthorizationNotice:
      overrides.requiresManagerAuthorizationNotice ?? false,
    isActive: true,
  };
}

function baseInput(
  overrides: Partial<ComparisonBuildInput> = {},
): ComparisonBuildInput {
  const tableA = baseTable({
    id: "t-a",
    companyId: "comp-a",
    productId: "prod-a",
    tableCode: "DEMO_A",
    customerTanPercent: 8,
  });
  const tableB = baseTable({
    id: "t-b",
    companyId: "comp-b",
    productId: "prod-b",
    tableCode: "DEMO_B",
    customerTanPercent: 10,
  });

  return {
    simulationId: "sim-demo",
    network: "PCG",
    calculationDate: new Date(2026, 0, 10).getTime(),
    patient: {
      age: 40,
      employmentType: "permanent_employee",
      isNonEuCitizen: false,
    },
    requestedAmount: 5000,
    preferredFirstInstallmentDelayDays: 30,
    selectedDurationMonths: 24,
    companies: [
      {
        id: "comp-a",
        name: "Demo Fin A",
        shortName: "DFA",
        isActive: true,
      },
      {
        id: "comp-b",
        name: "Demo Fin B",
        shortName: "DFB",
        isActive: true,
      },
    ],
    products: [
      { id: "prod-a", companyId: "comp-a", name: "Prodotto A", isActive: true },
      { id: "prod-b", companyId: "comp-b", name: "Prodotto B", isActive: true },
    ],
    tables: [tableA, tableB],
    rulesByTableId: {
      "t-a": [],
      "t-b": [],
    },
    priorities: [],
    internalMessages: [],
    ...overrides,
  };
}

describe(`confronto integrazione (${DEMO})`, () => {
  it("1. due finanziarie compatibili alla stessa durata", () => {
    const result = buildComparisonResult(baseInput());
    expect(result.selectedDurationMonths).toBe(24);
    expect(result.compatibleSolutions).toHaveLength(2);
    expect(
      result.compatibleSolutions.every((item) => item.durationMonths === 24),
    ).toBe(true);
  });

  it("2. una compatibile e una non compatibile per età", () => {
    const ageRule: RuntimePolicyRule = {
      id: "age",
      policySetId: "ps",
      scope: "company",
      ruleType: "minimum_age",
      operator: "greater_than_or_equal",
      numericValue: 50,
      failureMessage: "Età insufficiente",
      sortOrder: 1,
    };
    const result = buildComparisonResult(
      baseInput({
        patient: {
          age: 40,
          employmentType: "permanent_employee",
          isNonEuCitizen: false,
        },
        rulesByTableId: {
          "t-a": [],
          "t-b": [ageRule],
        },
      }),
    );
    expect(result.compatibleSolutions.map((s) => s.tableCode)).toEqual([
      "DEMO_A",
    ]);
    expect(result.incompatibleSolutions.map((s) => s.tableCode)).toEqual([
      "DEMO_B",
    ]);
  });

  it("3. una da verificare per regola custom", () => {
    const custom: RuntimePolicyRule = {
      id: "custom",
      policySetId: "ps",
      scope: "product",
      ruleType: "custom",
      operator: "custom",
      failureMessage: "Verifica discrezionale",
      verificationMessage: "Contattare underwriting",
      sortOrder: 1,
    };
    const result = buildComparisonResult(
      baseInput({
        rulesByTableId: { "t-a": [custom], "t-b": [] },
      }),
    );
    expect(result.verificationRequiredSolutions).toHaveLength(1);
    expect(result.compatibleSolutions).toHaveLength(1);
  });

  it("4. priorità aziendale su soluzione compatibile", () => {
    const result = buildComparisonResult(
      baseInput({
        priorities: [
          {
            id: "prio",
            network: "PCG",
            financialTableId: "t-b",
            label: "Priorità demo B",
            priorityScore: 80,
          },
        ],
      }),
    );
    expect(result.compatibleSolutions[0]?.tableCode).toBe("DEMO_B");
    expect(result.compatibleSolutions[0]?.isCompanyPriority).toBe(true);
    expect(result.compatibleSolutions[0]?.priorityLabel).toBe("Priorità demo B");
  });

  it("5. rata obiettivo", () => {
    const result = buildComparisonResult(
      baseInput({
        targetInstallment: 250,
        selectedDurationMonths: undefined,
        preferredDurationMonths: undefined,
      }),
    );
    expect(result.nearestTargetSolutionId).toBeTruthy();
    expect(result.compatibleSolutions.length).toBeGreaterThan(0);
  });

  it("6. tempo determinato con contratto breve", () => {
    const rule: RuntimePolicyRule = {
      id: "temp",
      policySetId: "ps",
      scope: "company",
      ruleType: "temporary_contract_expiry",
      operator: "date_after_financing_end",
      monthsBuffer: 0,
      failureMessage: "Contratto troppo breve",
      sortOrder: 1,
    };
    const result = buildComparisonResult(
      baseInput({
        patient: {
          age: 35,
          employmentType: "temporary_employee",
          isNonEuCitizen: false,
          temporaryContractExpiry: Date.UTC(2026, 2, 1),
        },
        rulesByTableId: { "t-a": [rule], "t-b": [rule] },
      }),
    );
    expect(result.incompatibleSolutions.length).toBe(2);
  });

  it("7. extracomunitario con permesso breve", () => {
    const rule: RuntimePolicyRule = {
      id: "permit",
      policySetId: "ps",
      scope: "company",
      ruleType: "residence_permit_expiry",
      operator: "date_after_financing_end",
      failureMessage: "Permesso insufficiente",
      sortOrder: 1,
    };
    const result = buildComparisonResult(
      baseInput({
        patient: {
          age: 35,
          employmentType: "permanent_employee",
          isNonEuCitizen: true,
          residencePermitExpiry: Date.UTC(2026, 2, 1),
        },
        rulesByTableId: { "t-a": [rule], "t-b": [rule] },
      }),
    );
    expect(result.incompatibleSolutions.length).toBe(2);
  });

  it("8. tasso zero con alert autorizzazione", () => {
    const result = buildComparisonResult(
      baseInput({
        tables: [
          baseTable({
            id: "t-a",
            companyId: "comp-a",
            productId: "prod-a",
            tableCode: "DEMO_ZERO",
            category: "zero_interest",
            customerTanPercent: 0,
            internalCostPercentAt24Months: 5,
            requiresManagerAuthorizationNotice: true,
          }),
        ],
        rulesByTableId: { "t-a": [] },
      }),
    );
    const solution = result.compatibleSolutions[0];
    expect(solution?.requiresManagerAuthorizationNotice).toBe(true);
    expect((solution?.calculation?.internalCostAmount ?? 0) > 0).toBe(true);
  });

  it("9. tasso standard senza costo interno", () => {
    const result = buildComparisonResult(baseInput());
    const solution = result.compatibleSolutions.find(
      (item) => item.tableCode === "DEMO_A",
    );
    expect(solution?.calculation?.internalCostAmount).toBe(0);
    expect(solution?.requiresManagerAuthorizationNotice).toBe(false);
  });

  it("10. differimento non supportato", () => {
    const result = buildComparisonResult(
      baseInput({
        selectedFirstInstallmentDelayDays: 90,
        tables: [
          baseTable({
            id: "t-a",
            companyId: "comp-a",
            productId: "prod-a",
            tableCode: "DEMO_A",
            firstInstallmentDelayDays: [30],
          }),
        ],
        rulesByTableId: { "t-a": [] },
      }),
    );
    expect(result.incompatibleSolutions).toHaveLength(1);
    expect(result.incompatibleSolutions[0]?.technicalExclusionReasons[0]).toMatch(
      /90 giorni/,
    );
    expect(result.incompatibleSolutions[0]?.calculation).toBeNull();
  });
});
