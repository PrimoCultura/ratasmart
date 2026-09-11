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
  NO_ZERO_INTEREST_COMPATIBLE_MESSAGE,
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

function isStandard(category: string): boolean {
  return category === "standard";
}

function isEligibleZeroInterest(solution: RuntimeFinancialSolution): boolean {
  return (
    solution.category === "zero_interest" &&
    solution.calculation !== null &&
    hasCompanyCostOrAuth(solution)
  );
}

/**
 * Ordine riferimento zero_interest:
 * 1. compatible (già filtrato)
 * 2. stessa durata del confronto (già filtrato nel comparison)
 * 3. minore totalCustomerRepayment
 * 4. minore company cost
 * 5. ranking commerciale (priorityScore desc)
 */
export function rankZeroInterestReferences(
  solutions: RuntimeFinancialSolution[],
): RuntimeFinancialSolution[] {
  return [...solutions].sort((a, b) => {
    const aTotal = a.calculation!.totalCustomerRepayment;
    const bTotal = b.calculation!.totalCustomerRepayment;
    if (aTotal !== bTotal) return aTotal - bTotal;
    const aCost = a.calculation!.internalCostAmount;
    const bCost = b.calculation!.internalCostAmount;
    if (aCost !== bCost) return aCost - bCost;
    return (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
  });
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
    referenceType: "zero_interest",
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

function rankStandardAlternatives(
  items: ZeroInterestAlternative[],
  standardById: Map<string, RuntimeFinancialSolution>,
  preferredZeroSolutionId?: string,
): ZeroInterestAlternative[] {
  return [...items].sort((a, b) => {
    if (preferredZeroSolutionId) {
      const aPreferred = a.zeroSolutionId === preferredZeroSolutionId ? 0 : 1;
      const bPreferred = b.zeroSolutionId === preferredZeroSolutionId ? 0 : 1;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
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

/**
 * Analizza alternative standard+sconto rispetto ESCLUSIVAMENTE a
 * soluzioni zero_interest compatible. Subsidized non partecipa.
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
  const zeroInterestSolutions = rankZeroInterestReferences(
    input.compatibleSolutions.filter(isEligibleZeroInterest),
  );
  const hasCompatibleZeroInterest = zeroInterestSolutions.length > 0;

  // Subsidized non viene usato: flag solo informativo (sempre false per la feature).
  const hasCompatibleSubsidized = false;

  if (!hasCompatibleZeroInterest) {
    return {
      version: ZERO_INTEREST_ALTERNATIVE_VERSION,
      enabled: true,
      referenceDate: input.referenceDate,
      originalAmount: input.requestedAmount,
      hasCompatibleZeroInterest: false,
      hasCompatibleSubsidized,
      alternatives: [],
      messages: [NO_ZERO_INTEREST_COMPATIBLE_MESSAGE],
    };
  }

  const preferredZero = zeroInterestSolutions[0]!;
  const standardSolutions = input.compatibleSolutions.filter(
    (solution) =>
      isStandard(solution.category) && solution.calculation !== null,
  );
  const standardById = new Map(
    standardSolutions.map((item) => [item.solutionId, item]),
  );

  const alternatives: ZeroInterestAlternative[] = [];
  let anySameDurationStandard = false;
  let anyBeyondLimit = false;

  for (const reference of zeroInterestSolutions) {
    const referenceCalc = reference.calculation!;
    const targetPatientTotal = referenceCalc.totalCustomerRepayment;

    const standardsSameDuration = standardSolutions.filter(
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
        config,
      });

      if (search.beyondConfiguredLimit) {
        anyBeyondLimit = true;
        continue;
      }
      if (!search.found || !search.calculation) continue;

      alternatives.push(
        buildAlternative({
          reference,
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

  if (alternatives.length === 0) {
    if (!anySameDurationStandard) {
      messages.push(
        "Non è disponibile un’alternativa standard equivalente sulla stessa durata.",
      );
    } else if (anyBeyondLimit) {
      messages.push(
        "Nessuna alternativa standard equivalente entro il limite configurato.",
      );
    } else {
      messages.push(
        "Nessuna alternativa standard equivalente trovata per le soluzioni a tasso zero disponibili.",
      );
    }
  }

  const ranked = rankStandardAlternatives(
    alternatives,
    standardById,
    preferredZero.solutionId,
  );
  const primary = ranked[0];

  return {
    version: ZERO_INTEREST_ALTERNATIVE_VERSION,
    enabled: true,
    referenceDate: input.referenceDate,
    originalAmount: input.requestedAmount,
    primaryReferenceType: primary ? "zero_interest" : undefined,
    hasCompatibleZeroInterest,
    hasCompatibleSubsidized,
    primary,
    alternatives: ranked,
    messages,
  };
}
