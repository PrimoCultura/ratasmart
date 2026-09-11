import type { FinancialCalculationResult } from "../financial-engine/types.ts";
import type { RuntimeFinancialSolution } from "../policy-engine/types.ts";
import type { RuntimeFinancialTable } from "../policy-engine/comparison.ts";
import { resolveTableEconomicsForDuration } from "../policy-engine/comparison.ts";
import {
  findEquivalentDiscountPercent,
  type StandardTableEconomics,
} from "./find-equivalent-discount.ts";
import {
  DOCTOR_COMPENSATION_NOTE,
  ZERO_INTEREST_ALTERNATIVE_CONFIG,
  ZERO_INTEREST_ALTERNATIVE_VERSION,
  ZERO_VS_STANDARD_AUTONOMY_WARNING,
  type ZeroInterestAlternative,
  type ZeroInterestAlternativeAnalysis,
  type ZeroInterestAlternativeConfig,
} from "./types.ts";
import {
  computeDoctorCompensationBaseReduction,
  computeDoctorCompensationBreakEvenPercent,
  computeNetCompanyDifferenceBeforeDoctorCompensation,
} from "./economic-impact.ts";

function hasCompanyCostOrAuth(solution: RuntimeFinancialSolution): boolean {
  return (
    (solution.calculation?.internalCostAmount ?? 0) > 0 ||
    solution.requiresManagerAuthorizationNotice
  );
}

function isZeroOrSubsidized(category: string): boolean {
  return category === "zero_interest" || category === "subsidized";
}

function isStandard(category: string): boolean {
  return category === "standard";
}

function toEconomics(
  table: RuntimeFinancialTable,
  durationMonths: number,
  delayDays: number,
): StandardTableEconomics | null {
  const economics = resolveTableEconomicsForDuration(table, durationMonths);
  if (!economics) return null;
  if (!table.firstInstallmentDelayDays.includes(delayDays)) return null;
  return {
    customerTanPercent: economics.customerTanPercent,
    openingFeeType: table.openingFeeType,
    openingFeeValue: table.openingFeeValue,
    collectionFeePerInstallment: table.collectionFeePerInstallment,
    installmentFeeType: table.installmentFeeType,
    installmentFeeValue: table.installmentFeeValue,
    internalCostPercentApplied: economics.internalCostPercentApplied,
    internalCostPercentAt24Months: table.internalCostPercentAt24Months,
    internalCostBase: table.internalCostBase,
    firstInstallmentDelayDays: delayDays,
    minimumAmount: economics.minimumAmount,
    maximumAmount: economics.maximumAmount,
    durationMonths,
  };
}

function buildAlternative(input: {
  zero: RuntimeFinancialSolution;
  standard: RuntimeFinancialSolution;
  zeroCalc: FinancialCalculationResult;
  standardCalc: FinancialCalculationResult;
  originalAmount: number;
  discountedAmount: number;
  discountPercent: number;
  equivalent: boolean;
}): ZeroInterestAlternative {
  const patientDiff =
    input.standardCalc.totalCustomerRepayment -
    input.zeroCalc.totalCustomerRepayment;
  const zeroRateNetToCompanyEuro = input.zeroCalc.netAmountPaidToCompany;
  const standardNetToCompanyEuro = input.standardCalc.netAmountPaidToCompany;
  const discountValueEuro =
    Math.round((input.originalAmount - input.discountedAmount) * 100) / 100;
  const netCompanyDifferenceBeforeDoctorCompensationEuro =
    computeNetCompanyDifferenceBeforeDoctorCompensation({
      standardNetToCompanyEuro,
      zeroRateNetToCompanyEuro,
    });
  const doctorCompensationBaseReductionEuro =
    computeDoctorCompensationBaseReduction({
      originalAmount: input.originalAmount,
      discountedAmount: input.discountedAmount,
    });
  const doctorCompensationBreakEvenPercent =
    computeDoctorCompensationBreakEvenPercent({
      netCompanyDifferenceBeforeDoctorCompensationEuro,
      doctorCompensationBaseReductionEuro,
    });

  return {
    zeroSolutionId: input.zero.solutionId,
    standardSolutionId: input.standard.solutionId,
    zeroCompanyShortName: input.zero.companyShortName,
    zeroTableCode: input.zero.tableCode,
    standardCompanyShortName: input.standard.companyShortName,
    standardTableCode: input.standard.tableCode,
    durationMonths: input.zero.durationMonths,
    originalAmount: input.originalAmount,
    discountedAmount: input.discountedAmount,
    discountPercent: input.discountPercent,
    zeroRateRequestedAmount: input.zeroCalc.requestedAmount,
    zeroRateOpeningFeeAmount: input.zeroCalc.openingFeeAmount,
    zeroRateFinancedAmount: input.zeroCalc.financedAmount,
    zeroRatePatientTotal: input.zeroCalc.totalCustomerRepayment,
    standardRequestedAmount: input.standardCalc.requestedAmount,
    standardOpeningFeeAmount: input.standardCalc.openingFeeAmount,
    standardFinancedAmount: input.standardCalc.financedAmount,
    standardPatientTotal: input.standardCalc.totalCustomerRepayment,
    patientTotalDifferenceEuro: Math.round(patientDiff * 100) / 100,
    zeroRateInstallment: input.zeroCalc.regularTotalInstallmentAmount,
    standardInstallment: input.standardCalc.regularTotalInstallmentAmount,
    installmentDifferenceEuro:
      Math.round(
        (input.standardCalc.regularTotalInstallmentAmount -
          input.zeroCalc.regularTotalInstallmentAmount) *
          100,
      ) / 100,
    zeroRateCompanyCostEuro: input.zeroCalc.internalCostAmount,
    standardCompanyCostEuro: input.standardCalc.internalCostAmount,
    zeroRateNetToCompanyEuro,
    standardNetToCompanyEuro,
    discountValueEuro,
    netCompanyDifferenceBeforeDoctorCompensationEuro,
    doctorCompensationBaseReductionEuro,
    doctorCompensationBreakEvenPercent,
    equivalent: input.equivalent,
    warning: ZERO_VS_STANDARD_AUTONOMY_WARNING,
    doctorCompensationNote: DOCTOR_COMPENSATION_NOTE,
  };
}

function rankAlternatives(
  items: ZeroInterestAlternative[],
  standardById: Map<string, RuntimeFinancialSolution>,
): ZeroInterestAlternative[] {
  return [...items].sort((a, b) => {
    const aStd = standardById.get(a.standardSolutionId);
    const bStd = standardById.get(b.standardSolutionId);
    const aCost = aStd ? (hasCompanyCostOrAuth(aStd) ? 1 : 0) : 1;
    const bCost = bStd ? (hasCompanyCostOrAuth(bStd) ? 1 : 0) : 1;
    if (aCost !== bCost) return aCost - bCost;
    if (a.discountPercent !== b.discountPercent) {
      return a.discountPercent - b.discountPercent;
    }
    const aDiff = Math.abs(a.patientTotalDifferenceEuro);
    const bDiff = Math.abs(b.patientTotalDifferenceEuro);
    if (aDiff !== bDiff) return aDiff - bDiff;
    const aRank = aStd?.priorityScore ?? 0;
    const bRank = bStd?.priorityScore ?? 0;
    return bRank - aRank;
  });
}

/**
 * Analizza alternative standard+sconto rispetto alle soluzioni zero/agevolate compatible.
 * Non modifica ranking del comparison.
 */
export function analyzeZeroInterestAlternative(input: {
  enabled: boolean;
  requestedAmount: number;
  referenceDate: number;
  compatibleSolutions: RuntimeFinancialSolution[];
  tablesById: Record<string, RuntimeFinancialTable>;
  config?: Partial<ZeroInterestAlternativeConfig>;
}): ZeroInterestAlternativeAnalysis {
  const config: ZeroInterestAlternativeConfig = {
    ...ZERO_INTEREST_ALTERNATIVE_CONFIG,
    ...input.config,
  };

  if (!input.enabled) {
    return {
      version: ZERO_INTEREST_ALTERNATIVE_VERSION,
      enabled: false,
      referenceDate: input.referenceDate,
      originalAmount: input.requestedAmount,
      alternatives: [],
      messages: [],
    };
  }

  const messages: string[] = [];
  const zeroSolutions = input.compatibleSolutions.filter(
    (solution) =>
      isZeroOrSubsidized(solution.category) &&
      solution.calculation !== null &&
      hasCompanyCostOrAuth(solution),
  );

  if (zeroSolutions.length === 0) {
    return {
      version: ZERO_INTEREST_ALTERNATIVE_VERSION,
      enabled: true,
      referenceDate: input.referenceDate,
      originalAmount: input.requestedAmount,
      alternatives: [],
      messages: [
        "Nessuna soluzione a tasso zero o agevolata compatible disponibile per il confronto.",
      ],
    };
  }

  const standardSolutions = input.compatibleSolutions.filter(
    (solution) =>
      isStandard(solution.category) && solution.calculation !== null,
  );

  const alternatives: ZeroInterestAlternative[] = [];
  const standardById = new Map(
    standardSolutions.map((item) => [item.solutionId, item]),
  );

  let anySameDurationStandard = false;
  let anyBeyondLimit = false;

  for (const zero of zeroSolutions) {
    const zeroCalc = zero.calculation!;
    const targetPatientTotal = zeroCalc.totalCustomerRepayment;

    const standardsSameDuration = standardSolutions.filter(
      (item) =>
        item.durationMonths === zero.durationMonths &&
        item.firstInstallmentDelayDays === zero.firstInstallmentDelayDays,
    );

    if (standardsSameDuration.length === 0) {
      continue;
    }
    anySameDurationStandard = true;

    for (const standard of standardsSameDuration) {
      const table = input.tablesById[standard.financialTableId];
      if (!table) continue;
      const economics = toEconomics(
        table,
        standard.durationMonths,
        standard.firstInstallmentDelayDays,
      );
      if (!economics) continue;

      const search = findEquivalentDiscountPercent({
        originalAmount: input.requestedAmount,
        targetPatientTotal,
        economics,
        config,
      });

      if (search.beyondConfiguredLimit) {
        anyBeyondLimit = true;
        continue;
      }
      if (!search.found || !search.calculation) continue;

      alternatives.push(
        buildAlternative({
          zero,
          standard,
          zeroCalc,
          standardCalc: search.calculation,
          originalAmount: input.requestedAmount,
          discountedAmount: search.discountedAmount,
          discountPercent: search.discountPercent,
          equivalent: true,
        }),
      );
    }
  }

  if (!anySameDurationStandard) {
    messages.push(
      "Non è disponibile un’alternativa standard equivalente sulla stessa durata.",
    );
  } else if (alternatives.length === 0 && anyBeyondLimit) {
    messages.push(
      "Nessuna alternativa standard equivalente entro il limite configurato.",
    );
  } else if (alternatives.length === 0) {
    messages.push(
      "Nessuna alternativa standard equivalente trovata per le soluzioni a tasso zero disponibili.",
    );
  }

  const ranked = rankAlternatives(alternatives, standardById);

  return {
    version: ZERO_INTEREST_ALTERNATIVE_VERSION,
    enabled: true,
    referenceDate: input.referenceDate,
    originalAmount: input.requestedAmount,
    primary: ranked[0],
    alternatives: ranked,
    messages,
  };
}
