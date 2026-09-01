import { describe, expect, it } from "vitest";
import {
  FISCAL_WARNING,
  FORMAL_COMPATIBILITY_DISCLAIMER,
} from "../../policy-engine/types.ts";
import type {
  RuntimeFinancialSolution,
  SimulationComparisonResult,
} from "../../policy-engine/types.ts";
import {
  canProposeSolution,
  mapAllSolutionsFromComparison,
  mapCalculationSummary,
  mapRuntimeComparisonToRunFields,
  mapRuntimeSolutionToPersistentSnapshot,
} from "../mapper.ts";
import type { TableMetadataForSnapshot } from "../types.ts";

function baseTable(
  overrides: Partial<TableMetadataForSnapshot> = {},
): TableMetadataForSnapshot {
  return {
    id: "table-1",
    version: 1,
    tableCode: "PCG-STD-01",
    displayName: "Standard 1",
    description: "Desc v1",
    network: "PCG",
    category: "standard",
    minimumAmount: 500,
    maximumAmount: 20000,
    minimumDurationMonths: 12,
    maximumDurationMonths: 60,
    durationStepMonths: 12,
    customerTanPercent: 8.5,
    openingFeeType: "percentage",
    openingFeeValue: 3,
    collectionFeePerInstallment: 1.5,
    internalCostPercentAt24Months: 2,
    firstInstallmentDelayDays: [30, 60],
    requiresManagerAuthorizationNotice: false,
    ...overrides,
  };
}

function baseSolution(
  overrides: Partial<RuntimeFinancialSolution> = {},
): RuntimeFinancialSolution {
  return {
    solutionId: "table-1:24:30",
    companyId: "company-1",
    companyName: "Findomestic",
    companyShortName: "FIN",
    productId: "product-1",
    productName: "Prestito Standard",
    financialTableId: "table-1",
    financialTableVersion: 1,
    tableCode: "PCG-STD-01",
    tableDisplayName: "Standard 1",
    category: "standard",
    network: "PCG",
    durationMonths: 24,
    firstInstallmentDelayDays: 30,
    calculation: {
      requestedAmount: 5000,
      openingFeeAmount: 150,
      financedAmount: 5150,
      durationMonths: 24,
      firstInstallmentDelayDays: 30,
      customerTanPercent: 8.5,
      monthlyNominalRate: 8.5 / 100 / 12,
      theoreticalBaseInstallmentAmount: 230,
      regularBaseInstallmentAmount: 230,
      collectionFeePerInstallment: 1.5,
      regularTotalInstallmentAmount: 231.5,
      finalTotalInstallmentAmount: 231.5,
      totalPrincipalRepaid: 5150,
      totalCustomerInterest: 400,
      totalCollectionFees: 36,
      totalCustomerRepayment: 5550,
      totalCustomerCosts: 550,
      internalCostPercentAt24Months: 2,
      internalCostPercentApplied: 2,
      internalCostAmount: 100,
      netAmountPaidToCompany: 5050,
      estimatedTaeg: {
        success: true,
        monthlyRate: 0.01,
        annualEffectiveRate: 0.12,
        taegPercent: 12.5,
        iterations: 10,
      },
      amortizationSchedule: [],
      warnings: [],
    },
    compatibility: {
      status: "compatible",
      passedRules: [
        {
          ruleId: "r1",
          ruleType: "minimum_age",
          status: "passed",
          message: "ok",
        },
      ],
      failedRules: [],
      verificationRules: [],
      notApplicableRules: [
        {
          ruleId: "r-na",
          ruleType: "pensioner_allowed",
          status: "not_applicable",
        },
      ],
      reasons: [],
      verificationReasons: [],
    },
    isCompanyPriority: true,
    priorityScore: 10,
    priorityLabel: "Priorità",
    priorityVisibleReason: "Motivo",
    internalMessageIds: ["msg-1"],
    requiresManagerAuthorizationNotice: false,
    distanceFromTargetInstallment: 1.5,
    technicalExclusionReasons: [],
    ...overrides,
  };
}

function baseResult(
  overrides: Partial<SimulationComparisonResult> = {},
): SimulationComparisonResult {
  return {
    simulationId: "sim-1",
    calculationDate: 1_700_000_000_000,
    network: "PCG",
    selectedDurationMonths: 24,
    selectedFirstInstallmentDelayDays: 30,
    targetInstallment: 230,
    compatibleSolutions: [baseSolution()],
    verificationRequiredSolutions: [],
    incompatibleSolutions: [],
    availableComparisonDurations: [12, 24, 36],
    nearestTargetSolutionId: "table-1:24:30",
    disclaimer: FORMAL_COMPATIBILITY_DISCLAIMER,
    fiscalWarning: FISCAL_WARNING,
    warnings: [],
    ...overrides,
  };
}

describe("mapRuntimeComparisonToRunFields", () => {
  it("mappa conteggi, nearest e versioni motore", () => {
    const fields = mapRuntimeComparisonToRunFields({
      result: baseResult(),
      patientSnapshot: {
        firstName: "Mario",
        lastName: "Rossi",
        age: 40,
        employmentType: "permanent_employee",
        isNonEuCitizen: false,
      },
      requestedAmount: 5000,
      engineVersion: "1.0.0",
      policyEngineVersion: "1.0.0",
      source: "initial_calculation",
    });

    expect(fields.compatibleSolutionsCount).toBe(1);
    expect(fields.verificationRequiredSolutionsCount).toBe(0);
    expect(fields.incompatibleSolutionsCount).toBe(0);
    expect(fields.nearestTargetSolutionRuntimeId).toBe("table-1:24:30");
    expect(fields.engineVersion).toBe("1.0.0");
    expect(fields.policyEngineVersion).toBe("1.0.0");
    expect(fields.source).toBe("initial_calculation");
    expect(fields.targetInstallment).toBe(230);
  });
});

describe("mapRuntimeSolutionToPersistentSnapshot", () => {
  it("conserva versione/TAN/fee anche se la tabella 'viva' è stata aggiornata", () => {
    const tableV1 = baseTable({
      version: 1,
      customerTanPercent: 8.5,
      openingFeeValue: 3,
      description: "v1",
    });
    // Simula tabella aggiornata a v2 (non usata nello snapshot se passiamo v1)
    const _tableV2 = baseTable({
      version: 2,
      customerTanPercent: 9.9,
      openingFeeValue: 5,
      description: "v2",
    });
    void _tableV2;

    const snapshot = mapRuntimeSolutionToPersistentSnapshot({
      solution: baseSolution({ financialTableVersion: 1 }),
      resultGroup: "compatible",
      rankPosition: 1,
      table: tableV1,
      product: { id: "product-1", name: "Prestito Standard", code: "STD" },
      messagesById: {
        "msg-1": {
          id: "msg-1",
          title: "Info",
          message: "Messaggio",
          messageType: "information",
          iconType: "info",
          requiresPrivacyConfirmation: true,
        },
      },
    });

    expect(snapshot.financialTableSnapshot.version).toBe(1);
    expect(snapshot.financialTableSnapshot.customerTanPercent).toBe(8.5);
    expect(snapshot.financialTableSnapshot.openingFeeValue).toBe(3);
    expect(snapshot.financialTableSnapshot.description).toBe("v1");
    expect(snapshot.productSnapshot.code).toBe("STD");
    expect(snapshot.rankPosition).toBe(1);
    expect(snapshot.resultGroup).toBe("compatible");
    expect(snapshot.internalMessagesSnapshot).toHaveLength(1);
    expect(snapshot.internalMessagesSnapshot[0]?.requiresPrivacyConfirmation).toBe(
      true,
    );
    // not_applicable non salvate
    expect(
      (snapshot.compatibilitySnapshot as { notApplicableRules?: unknown })
        .notApplicableRules,
    ).toBeUndefined();
    expect(snapshot.calculationSummary?.taegCalculationSucceeded).toBe(true);
    expect(snapshot.calculationSummary?.taegPercent).toBe(12.5);
    // nessun amortizationSchedule
    expect(
      (snapshot.calculationSummary as { amortizationSchedule?: unknown })
        ?.amortizationSchedule,
    ).toBeUndefined();
  });

  it("gestisce soluzione senza calcolo", () => {
    const snapshot = mapRuntimeSolutionToPersistentSnapshot({
      solution: baseSolution({
        calculation: null,
        compatibility: {
          status: "not_compatible",
          passedRules: [],
          failedRules: [],
          verificationRules: [],
          notApplicableRules: [],
          reasons: ["Importo fuori range"],
          verificationReasons: [],
        },
        technicalExclusionReasons: ["Importo fuori range"],
      }),
      resultGroup: "not_compatible",
      rankPosition: 1,
      table: baseTable(),
      messagesById: {},
    });

    expect(snapshot.calculationSummary).toBeUndefined();
    expect(snapshot.technicalExclusionReasons).toEqual(["Importo fuori range"]);
  });

  it("gestisce TAEG fallito senza taegPercent", () => {
    const solution = baseSolution();
    solution.calculation = {
      ...solution.calculation!,
      estimatedTaeg: {
        success: false,
        monthlyRate: null,
        annualEffectiveRate: null,
        taegPercent: null,
        iterations: 50,
        errorCode: "NO_VALID_ROOT",
        errorMessage: "fail",
      },
    };

    const summary = mapCalculationSummary(solution.calculation);
    expect(summary?.taegCalculationSucceeded).toBe(false);
    expect(summary?.taegPercent).toBeUndefined();
  });

  it("assegna ranking e gruppi correttamente", () => {
    const compatible = baseSolution({ solutionId: "c1" });
    const verification = baseSolution({
      solutionId: "v1",
      compatibility: {
        status: "verification_required",
        passedRules: [],
        failedRules: [],
        verificationRules: [
          {
            ruleId: "vr",
            ruleType: "custom",
            status: "verification_required",
            message: "verifica",
          },
        ],
        notApplicableRules: [],
        reasons: [],
        verificationReasons: ["verifica"],
      },
    });
    const incompatible = baseSolution({
      solutionId: "i1",
      calculation: null,
      compatibility: {
        status: "not_compatible",
        passedRules: [],
        failedRules: [],
        verificationRules: [],
        notApplicableRules: [],
        reasons: ["no"],
        verificationReasons: [],
      },
    });

    const mapped = mapAllSolutionsFromComparison({
      result: baseResult({
        compatibleSolutions: [compatible],
        verificationRequiredSolutions: [verification],
        incompatibleSolutions: [incompatible],
      }),
      tablesById: { "table-1": baseTable() },
      productsById: {
        "product-1": { id: "product-1", name: "P", code: "C" },
      },
      messagesById: {},
      requestedAmount: 5000,
    });

    expect(mapped).toHaveLength(3);
    expect(mapped[0]?.resultGroup).toBe("compatible");
    expect(mapped[0]?.rankPosition).toBe(1);
    expect(mapped[1]?.resultGroup).toBe("verification_required");
    expect(mapped[2]?.resultGroup).toBe("not_compatible");
    expect(mapped[2]?.calculationInputSnapshot.requestedAmount).toBe(5000);
  });
});

describe("canProposeSolution", () => {
  it("consente solo soluzioni compatibili con calcolo dello stesso CM", () => {
    expect(
      canProposeSolution({
        resultGroup: "compatible",
        hasCalculationSummary: true,
        solutionOwnerUserId: "u1",
        simulationOwnerUserId: "u1",
      }),
    ).toBe(true);

    expect(
      canProposeSolution({
        resultGroup: "verification_required",
        hasCalculationSummary: true,
        solutionOwnerUserId: "u1",
        simulationOwnerUserId: "u1",
      }),
    ).toBe(false);

    expect(
      canProposeSolution({
        resultGroup: "not_compatible",
        hasCalculationSummary: true,
        solutionOwnerUserId: "u1",
        simulationOwnerUserId: "u1",
      }),
    ).toBe(false);

    expect(
      canProposeSolution({
        resultGroup: "compatible",
        hasCalculationSummary: false,
        solutionOwnerUserId: "u1",
        simulationOwnerUserId: "u1",
      }),
    ).toBe(false);

    expect(
      canProposeSolution({
        resultGroup: "compatible",
        hasCalculationSummary: true,
        solutionOwnerUserId: "u1",
        simulationOwnerUserId: "u2",
      }),
    ).toBe(false);
  });
});
