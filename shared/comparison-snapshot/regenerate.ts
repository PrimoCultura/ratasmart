import {
  FINANCIAL_ENGINE_VERSION,
  almostEqual,
  calculateFinancialSolution,
} from "../financial-engine/index.ts";
import type {
  AmortizationRow,
  FinancialCalculationResult,
} from "../financial-engine/types.ts";
import { mapCalculationSummary } from "./mapper.ts";
import type {
  CalculationInputSnapshot,
  CalculationSummarySnapshot,
} from "./types.ts";

export const STALE_ENGINE_VERSION_WARNING =
  "Il confronto è stato creato con una versione precedente del motore finanziario. Il riepilogo salvato resta invariato; il piano rigenerato potrebbe presentare differenze di arrotondamento.";

const SUMMARY_TOLERANCE_EUR = 0.01;

const MONEY_FIELDS: Array<keyof CalculationSummarySnapshot> = [
  "openingFeeAmount",
  "financedAmount",
  "regularBaseInstallmentAmount",
  "collectionFeePerInstallment",
  "regularTotalInstallmentAmount",
  "finalTotalInstallmentAmount",
  "totalPrincipalRepaid",
  "totalCustomerInterest",
  "totalCollectionFees",
  "totalCustomerRepayment",
  "totalCustomerCosts",
  "internalCostAmount",
  "netAmountPaidToCompany",
];

export function isStaleEngineVersion(
  snapshotEngineVersion: string,
  currentEngineVersion: string = FINANCIAL_ENGINE_VERSION,
): boolean {
  return snapshotEngineVersion !== currentEngineVersion;
}

export function getStaleEngineVersionWarning(
  snapshotEngineVersion: string,
  currentEngineVersion: string = FINANCIAL_ENGINE_VERSION,
): string | undefined {
  if (isStaleEngineVersion(snapshotEngineVersion, currentEngineVersion)) {
    return STALE_ENGINE_VERSION_WARNING;
  }
  return undefined;
}

export function compareCalculationSummaries(
  expected: CalculationSummarySnapshot,
  actual: CalculationSummarySnapshot,
  toleranceEur: number = SUMMARY_TOLERANCE_EUR,
): { matches: boolean; differingFields: string[] } {
  const differingFields: string[] = [];

  for (const field of MONEY_FIELDS) {
    const left = expected[field];
    const right = actual[field];
    if (typeof left !== "number" || typeof right !== "number") {
      continue;
    }
    if (!almostEqual(left, right, toleranceEur)) {
      differingFields.push(field);
    }
  }

  if (expected.taegCalculationSucceeded !== actual.taegCalculationSucceeded) {
    differingFields.push("taegCalculationSucceeded");
  }

  if (
    expected.taegPercent !== undefined &&
    actual.taegPercent !== undefined &&
    !almostEqual(expected.taegPercent, actual.taegPercent, 0.0001)
  ) {
    differingFields.push("taegPercent");
  }

  return {
    matches: differingFields.length === 0,
    differingFields,
  };
}

export type RegenerateAmortizationResult = {
  calculation: FinancialCalculationResult;
  amortizationSchedule: AmortizationRow[];
  regeneratedSummary: CalculationSummarySnapshot;
  summaryMatches: boolean;
  differingFields: string[];
  warnings: string[];
};

/**
 * Rigenera il piano di ammortamento dagli input fotografati.
 * Non legge tabelle correnti. Confronta il riepilogo entro €0,01.
 */
export function regenerateAmortizationFromInputSnapshot(input: {
  calculationInput: CalculationInputSnapshot;
  expectedSummary?: CalculationSummarySnapshot;
  snapshotEngineVersion?: string;
  currentEngineVersion?: string;
}): RegenerateAmortizationResult {
  const warnings: string[] = [];

  if (input.snapshotEngineVersion) {
    const stale = getStaleEngineVersionWarning(
      input.snapshotEngineVersion,
      input.currentEngineVersion,
    );
    if (stale) {
      warnings.push(stale);
    }
  }

  const calculation = calculateFinancialSolution({
    requestedAmount: input.calculationInput.requestedAmount,
    durationMonths: input.calculationInput.durationMonths,
    customerTanPercent: input.calculationInput.customerTanPercent,
    openingFeeType: input.calculationInput.openingFeeType,
    openingFeeValue: input.calculationInput.openingFeeValue,
    collectionFeePerInstallment:
      input.calculationInput.collectionFeePerInstallment,
    internalCostPercentAt24Months:
      input.calculationInput.internalCostPercentAt24Months,
    firstInstallmentDelayDays:
      input.calculationInput.firstInstallmentDelayDays,
  });

  const regeneratedSummary = mapCalculationSummary(calculation);
  if (!regeneratedSummary) {
    throw new Error("Impossibile generare il riepilogo dal calcolo.");
  }

  let summaryMatches = true;
  let differingFields: string[] = [];

  if (input.expectedSummary) {
    const comparison = compareCalculationSummaries(
      input.expectedSummary,
      regeneratedSummary,
    );
    summaryMatches = comparison.matches;
    differingFields = comparison.differingFields;
    if (!summaryMatches) {
      warnings.push(
        `Differenza rispetto al riepilogo salvato sui campi: ${differingFields.join(", ")}.`,
      );
    }
  }

  return {
    calculation,
    amortizationSchedule: calculation.amortizationSchedule,
    regeneratedSummary,
    summaryMatches,
    differingFields,
    warnings,
  };
}
