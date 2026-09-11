import { calculateFinancialSolution } from "../financial-engine/index.ts";
import type {
  FinancialCalculationResult,
  InstallmentFeeType,
  InternalCostBase,
  OpeningFeeType,
} from "../financial-engine/types.ts";
import {
  ZERO_INTEREST_ALTERNATIVE_CONFIG,
  type ZeroInterestAlternativeConfig,
} from "./types.ts";

export type StandardTableEconomics = {
  customerTanPercent: number;
  openingFeeType: OpeningFeeType;
  openingFeeValue: number;
  collectionFeePerInstallment: number;
  installmentFeeType?: InstallmentFeeType;
  installmentFeeValue?: number;
  internalCostPercentApplied?: number;
  internalCostPercentAt24Months?: number;
  internalCostBase?: InternalCostBase;
  firstInstallmentDelayDays: number;
  minimumAmount: number;
  maximumAmount: number;
  durationMonths: number;
};

export function resolveEquivalenceTolerance(
  targetPatientTotal: number,
  config: ZeroInterestAlternativeConfig = ZERO_INTEREST_ALTERNATIVE_CONFIG,
): number {
  const percentBand =
    (targetPatientTotal * config.equivalenceTolerancePercent) / 100;
  return Math.max(config.equivalenceToleranceEuro, percentBand);
}

export function isPatientTotalEquivalent(input: {
  standardPatientTotal: number;
  targetPatientTotal: number;
  config?: ZeroInterestAlternativeConfig;
}): boolean {
  const tolerance = resolveEquivalenceTolerance(
    input.targetPatientTotal,
    input.config,
  );
  return (
    Math.abs(input.standardPatientTotal - input.targetPatientTotal) <= tolerance
  );
}

export function calculateStandardAtAmount(input: {
  requestedAmount: number;
  economics: StandardTableEconomics;
}): FinancialCalculationResult | null {
  const { economics } = input;
  if (
    input.requestedAmount < economics.minimumAmount ||
    input.requestedAmount > economics.maximumAmount
  ) {
    return null;
  }
  return calculateFinancialSolution({
    requestedAmount: input.requestedAmount,
    durationMonths: economics.durationMonths,
    customerTanPercent: economics.customerTanPercent,
    openingFeeType: economics.openingFeeType,
    openingFeeValue: economics.openingFeeValue,
    collectionFeePerInstallment: economics.collectionFeePerInstallment,
    installmentFeeType: economics.installmentFeeType,
    installmentFeeValue: economics.installmentFeeValue,
    internalCostPercentApplied: economics.internalCostPercentApplied,
    internalCostPercentAt24Months: economics.internalCostPercentAt24Months,
    internalCostBase: economics.internalCostBase,
    firstInstallmentDelayDays: economics.firstInstallmentDelayDays,
  });
}

/**
 * Binary search deterministica su discountPercent (0 → max).
 * Target = totalCustomerRepayment della soluzione zero (NON requestedAmount).
 */
export function findEquivalentDiscountPercent(input: {
  originalAmount: number;
  /** DEVE essere zeroSolution.totalCustomerRepayment */
  targetPatientTotal: number;
  economics: StandardTableEconomics;
  config?: ZeroInterestAlternativeConfig;
}): {
  found: boolean;
  discountPercent: number;
  discountedAmount: number;
  calculation: FinancialCalculationResult | null;
  beyondConfiguredLimit: boolean;
} {
  const config = input.config ?? ZERO_INTEREST_ALTERNATIVE_CONFIG;
  const max = config.maxSuggestedDiscountPercent;

  if (!(input.originalAmount > 0) || !(input.targetPatientTotal > 0)) {
    return {
      found: false,
      discountPercent: 0,
      discountedAmount: input.originalAmount,
      calculation: null,
      beyondConfiguredLimit: false,
    };
  }

  const evaluate = (discountPercent: number) => {
    const discountedAmount = roundMoney2(
      input.originalAmount * (1 - discountPercent / 100),
    );
    const calculation = calculateStandardAtAmount({
      requestedAmount: discountedAmount,
      economics: input.economics,
    });
    return { discountPercent, discountedAmount, calculation };
  };

  // Se anche al massimo sconto il totale resta troppo alto → oltre limite.
  const atMax = evaluate(max);
  if (
    atMax.calculation &&
    atMax.calculation.totalCustomerRepayment - input.targetPatientTotal >
      resolveEquivalenceTolerance(input.targetPatientTotal, config)
  ) {
    return {
      found: false,
      discountPercent: max,
      discountedAmount: atMax.discountedAmount,
      calculation: atMax.calculation,
      beyondConfiguredLimit: true,
    };
  }

  // Se a 0% già sotto/entro target, sconto 0 (o il migliore vicino).
  let best = evaluate(0);
  let bestDiff = best.calculation
    ? Math.abs(best.calculation.totalCustomerRepayment - input.targetPatientTotal)
    : Number.POSITIVE_INFINITY;

  let low = 0;
  let high = max;

  for (let i = 0; i < 48; i += 1) {
    const mid = roundPercent2((low + high) / 2);
    const candidate = evaluate(mid);
    if (!candidate.calculation) {
      // Importo fuori range tabella: aumenta sconto (importo più basso) se sopra max,
      // altrimenti riduci sconto.
      if (candidate.discountedAmount > input.economics.maximumAmount) {
        low = mid;
      } else {
        high = mid;
      }
      continue;
    }

    const total = candidate.calculation.totalCustomerRepayment;
    const diff = Math.abs(total - input.targetPatientTotal);
    if (
      diff < bestDiff ||
      (diff === bestDiff &&
        candidate.discountPercent < (best.discountPercent ?? max))
    ) {
      best = candidate;
      bestDiff = diff;
    }

    if (total > input.targetPatientTotal) {
      low = mid;
    } else {
      high = mid;
    }

    if (high - low < 0.005) break;
  }

  // Raffinamento a 0.01%
  for (
    let discount = Math.max(0, roundPercent2((best.discountPercent ?? 0) - 0.5));
    discount <= Math.min(max, roundPercent2((best.discountPercent ?? 0) + 0.5));
    discount = roundPercent2(discount + 0.01)
  ) {
    const candidate = evaluate(discount);
    if (!candidate.calculation) continue;
    const diff = Math.abs(
      candidate.calculation.totalCustomerRepayment - input.targetPatientTotal,
    );
    if (
      diff < bestDiff ||
      (diff === bestDiff && candidate.discountPercent < best.discountPercent)
    ) {
      best = candidate;
      bestDiff = diff;
    }
  }

  if (!best.calculation) {
    return {
      found: false,
      discountPercent: 0,
      discountedAmount: input.originalAmount,
      calculation: null,
      beyondConfiguredLimit: false,
    };
  }

  const equivalent = isPatientTotalEquivalent({
    standardPatientTotal: best.calculation.totalCustomerRepayment,
    targetPatientTotal: input.targetPatientTotal,
    config,
  });

  if (!equivalent && best.discountPercent >= max - 0.001) {
    return {
      found: false,
      discountPercent: best.discountPercent,
      discountedAmount: best.discountedAmount,
      calculation: best.calculation,
      beyondConfiguredLimit: true,
    };
  }

  return {
    found: equivalent,
    discountPercent: best.discountPercent,
    discountedAmount: best.discountedAmount,
    calculation: best.calculation,
    beyondConfiguredLimit: !equivalent && best.discountPercent >= max - 0.001,
  };
}

function roundMoney2(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent2(value: number): number {
  return Math.round(value * 100) / 100;
}
