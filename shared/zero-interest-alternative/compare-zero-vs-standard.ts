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
  NO_ZERO_INTEREST_ON_DURATION_MESSAGE,
  ZERO_INTEREST_ALTERNATIVE_CONFIG,
  ZERO_INTEREST_ALTERNATIVE_VERSION,
  ZERO_VS_STANDARD_AUTONOMY_WARNING,
  type ZeroInterestAlternative,
  type ZeroInterestAlternativeAnalysis,
  type ZeroInterestAlternativeConfig,
  type ZeroInterestReferenceType,
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

function isStandard(category: string): boolean {
  return category === "standard";
}

function isEligibleReference(
  solution: RuntimeFinancialSolution,
  referenceType: ZeroInterestReferenceType,
): boolean {
  return (
    solution.category === referenceType &&
    solution.calculation !== null &&
    hasCompanyCostOrAuth(solution)
  );
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
  reference: RuntimeFinancialSolution;
  referenceType: ZeroInterestReferenceType;
  standard: RuntimeFinancialSolution;
  referenceCalc: FinancialCalculationResult;
  standardCalc: FinancialCalculationResult;
  originalAmount: number;
  discountedAmount: number;
  discountPercent: number;
  equivalent: boolean;
}): ZeroInterestAlternative {
  const patientDiff =
    input.standardCalc.totalCustomerRepayment -
    input.referenceCalc.totalCustomerRepayment;
  const zeroRateNetToCompanyEuro = input.referenceCalc.netAmountPaidToCompany;
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
    referenceType: input.referenceType,
    referenceCustomerTanPercent: input.referenceCalc.customerTanPercent,
    zeroSolutionId: input.reference.solutionId,
    standardSolutionId: input.standard.solutionId,
    zeroCompanyShortName: input.reference.companyShortName,
    zeroTableCode: input.reference.tableCode,
    standardCompanyShortName: input.standard.companyShortName,
    standardTableCode: input.standard.tableCode,
    durationMonths: input.reference.durationMonths,
    originalAmount: input.originalAmount,
    discountedAmount: input.discountedAmount,
    discountPercent: input.discountPercent,
    zeroRateRequestedAmount: input.referenceCalc.requestedAmount,
    zeroRateOpeningFeeAmount: input.referenceCalc.openingFeeAmount,
    zeroRateFinancedAmount: input.referenceCalc.financedAmount,
    zeroRatePatientTotal: input.referenceCalc.totalCustomerRepayment,
    standardRequestedAmount: input.standardCalc.requestedAmount,
    standardOpeningFeeAmount: input.standardCalc.openingFeeAmount,
    standardFinancedAmount: input.standardCalc.financedAmount,
    standardPatientTotal: input.standardCalc.totalCustomerRepayment,
    patientTotalDifferenceEuro: Math.round(patientDiff * 100) / 100,
    zeroRateInstallment: input.referenceCalc.regularTotalInstallmentAmount,
    standardInstallment: input.standardCalc.regularTotalInstallmentAmount,
    installmentDifferenceEuro:
      Math.round(
        (input.standardCalc.regularTotalInstallmentAmount -
          input.referenceCalc.regularTotalInstallmentAmount) *
          100,
      ) / 100,
    zeroRateCompanyCostEuro: input.referenceCalc.internalCostAmount,
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
    // Preferisci sempre zero_interest rispetto a subsidized.
    if (a.referenceType !== b.referenceType) {
      return a.referenceType === "zero_interest" ? -1 : 1;
    }
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

function collectAlternativesForReferences(input: {
  references: RuntimeFinancialSolution[];
  referenceType: ZeroInterestReferenceType;
  standardSolutions: RuntimeFinancialSolution[];
  tablesById: Record<string, RuntimeFinancialTable>;
  requestedAmount: number;
  config: ZeroInterestAlternativeConfig;
}): {
  alternatives: ZeroInterestAlternative[];
  anySameDurationStandard: boolean;
  anyBeyondLimit: boolean;
} {
  const alternatives: ZeroInterestAlternative[] = [];
  let anySameDurationStandard = false;
  let anyBeyondLimit = false;

  for (const reference of input.references) {
    const referenceCalc = reference.calculation!;
    const targetPatientTotal = referenceCalc.totalCustomerRepayment;

    const standardsSameDuration = input.standardSolutions.filter(
      (item) =>
        item.durationMonths === reference.durationMonths &&
        item.firstInstallmentDelayDays === reference.firstInstallmentDelayDays,
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
        config: input.config,
      });

      if (search.beyondConfiguredLimit) {
        anyBeyondLimit = true;
        continue;
      }
      if (!search.found || !search.calculation) continue;

      alternatives.push(
        buildAlternative({
          reference,
          referenceType: input.referenceType,
          standard,
          referenceCalc,
          standardCalc: search.calculation,
          originalAmount: input.requestedAmount,
          discountedAmount: search.discountedAmount,
          discountPercent: search.discountPercent,
          equivalent: true,
        }),
      );
    }
  }

  return { alternatives, anySameDurationStandard, anyBeyondLimit };
}

/**
 * Analizza alternative standard+sconto rispetto a soluzioni
 * zero_interest (prioritarie) o subsidized (fallback).
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
      hasCompatibleZeroInterest: false,
      hasCompatibleSubsidized: false,
      alternatives: [],
      messages: [],
    };
  }

  const messages: string[] = [];
  const zeroInterestSolutions = input.compatibleSolutions.filter((solution) =>
    isEligibleReference(solution, "zero_interest"),
  );
  const subsidizedSolutions = input.compatibleSolutions.filter((solution) =>
    isEligibleReference(solution, "subsidized"),
  );

  const hasCompatibleZeroInterest = zeroInterestSolutions.length > 0;
  const hasCompatibleSubsidized = subsidizedSolutions.length > 0;

  if (!hasCompatibleZeroInterest && !hasCompatibleSubsidized) {
    return {
      version: ZERO_INTEREST_ALTERNATIVE_VERSION,
      enabled: true,
      referenceDate: input.referenceDate,
      originalAmount: input.requestedAmount,
      hasCompatibleZeroInterest: false,
      hasCompatibleSubsidized: false,
      alternatives: [],
      messages: [
        "Nessuna soluzione a tasso zero o agevolata compatible disponibile per il confronto.",
      ],
    };
  }

  if (!hasCompatibleZeroInterest) {
    messages.push(NO_ZERO_INTEREST_ON_DURATION_MESSAGE);
  }

  const standardSolutions = input.compatibleSolutions.filter(
    (solution) =>
      isStandard(solution.category) && solution.calculation !== null,
  );
  const standardById = new Map(
    standardSolutions.map((item) => [item.solutionId, item]),
  );

  const fromZero = collectAlternativesForReferences({
    references: zeroInterestSolutions,
    referenceType: "zero_interest",
    standardSolutions,
    tablesById: input.tablesById,
    requestedAmount: input.requestedAmount,
    config,
  });

  let alternatives = fromZero.alternatives;
  let anySameDurationStandard = fromZero.anySameDurationStandard;
  let anyBeyondLimit = fromZero.anyBeyondLimit;
  let usedReferenceType: ZeroInterestReferenceType | undefined =
    alternatives.length > 0 ? "zero_interest" : undefined;

  // Fallback: solo se non esiste alternativa su vero tasso zero.
  if (alternatives.length === 0 && hasCompatibleSubsidized) {
    const fromSubsidized = collectAlternativesForReferences({
      references: subsidizedSolutions,
      referenceType: "subsidized",
      standardSolutions,
      tablesById: input.tablesById,
      requestedAmount: input.requestedAmount,
      config,
    });
    alternatives = fromSubsidized.alternatives;
    anySameDurationStandard =
      anySameDurationStandard || fromSubsidized.anySameDurationStandard;
    anyBeyondLimit = anyBeyondLimit || fromSubsidized.anyBeyondLimit;
    if (alternatives.length > 0) {
      usedReferenceType = "subsidized";
    }
  }

  if (alternatives.length === 0) {
    if (!anySameDurationStandard) {
      messages.push(
        "Non è disponibile un’alternativa standard equivalente sulla stessa durata.",
      );
    } else if (anyBeyondLimit) {
      messages.push(
        "Nessuna alternativa standard equivalente entro il limite configurato.",
      );
    } else if (hasCompatibleZeroInterest) {
      messages.push(
        "Nessuna alternativa standard equivalente trovata per le soluzioni a tasso zero disponibili.",
      );
    } else {
      messages.push(
        "Nessuna alternativa standard equivalente trovata per le soluzioni agevolate disponibili.",
      );
    }
  }

  const ranked = rankAlternatives(alternatives, standardById);
  const primary = ranked[0];

  return {
    version: ZERO_INTEREST_ALTERNATIVE_VERSION,
    enabled: true,
    referenceDate: input.referenceDate,
    originalAmount: input.requestedAmount,
    primaryReferenceType: primary?.referenceType ?? usedReferenceType,
    hasCompatibleZeroInterest,
    hasCompatibleSubsidized,
    primary,
    alternatives: ranked,
    messages,
  };
}
