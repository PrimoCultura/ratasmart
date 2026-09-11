import { calculateFinancingEndDate } from "../policy-engine/date-utils.ts";
import type { PatientFinancialProfile } from "../policy-engine/types.ts";
import { evaluateIncomeDocumentRequirements } from "../documentation-requirements/index.ts";
import {
  analyzeBlockingConstraints,
  formatItDateExport,
  type FailedRuleSignal,
} from "./analyze-failure-reasons.ts";
import {
  ALTERNATIVE_DIAGNOSTICS_VERSION,
  type AlternativeScenario,
  type ComparisonDiagnostics,
  type InformationalSuggestion,
} from "./diagnostic-types.ts";

export type PersistedSolutionForDiagnostics = {
  resultGroup: "compatible" | "verification_required" | "not_compatible";
  companyShortName: string;
  compatibilitySnapshot?: {
    failedRules?: Array<{ ruleType: string; message?: string }>;
    verificationRules?: Array<{ ruleType: string; message?: string }>;
  };
  technicalExclusionReasons?: string[];
  openingFeeAmount?: number;
};

/**
 * Ricostruisce la diagnostica dai soli dati fotografati del run.
 * Non usa tabelle/policy correnti: niente alternative economiche “ora disponibili”
 * se non già persistite nello snapshot.
 */
export function buildDiagnosticsFromPersistedComparison(input: {
  hasCompatibleSolutions: boolean;
  verificationRequiredCount?: number;
  calculationDate: number;
  requestedAmount: number;
  selectedDurationMonths: number;
  firstInstallmentDelayDays: number;
  patient: PatientFinancialProfile;
  solutions: PersistedSolutionForDiagnostics[];
}): ComparisonDiagnostics {
  const verificationRequiredCount =
    input.verificationRequiredCount ??
    input.solutions.filter(
      (item) => item.resultGroup === "verification_required",
    ).length;

  const financedFees = input.solutions.reduce((max, solution) => {
    const fee = solution.openingFeeAmount;
    if (typeof fee === "number" && Number.isFinite(fee) && fee > max) {
      return fee;
    }
    return max;
  }, 0);

  const documentationRequirements = evaluateIncomeDocumentRequirements({
    requestedAmount: input.requestedAmount,
    financedFees,
    isNonEuCitizen: input.patient.isNonEuCitizen,
  });

  if (input.hasCompatibleSolutions) {
    return {
      version: ALTERNATIVE_DIAGNOSTICS_VERSION,
      hasCompatibleSolutions: true,
      verificationRequiredCount,
      blockingConstraints: [],
      nearestAlternatives: [],
      informationalSuggestions: [],
      documentationRequirements,
    };
  }

  const failedRules: FailedRuleSignal[] = [];
  for (const solution of input.solutions) {
    if (solution.resultGroup === "compatible") continue;
    for (const rule of solution.compatibilitySnapshot?.failedRules ?? []) {
      failedRules.push({
        ruleType: rule.ruleType,
        message: rule.message,
        companyShortName: solution.companyShortName,
        severity: "blocking",
      });
    }
    for (const rule of solution.compatibilitySnapshot?.verificationRules ?? []) {
      failedRules.push({
        ruleType: rule.ruleType,
        message: rule.message,
        companyShortName: solution.companyShortName,
        severity: "verification",
      });
    }
  }

  const { blockingConstraints, primaryConstraint } = analyzeBlockingConstraints({
    patient: input.patient,
    calculationDate: input.calculationDate,
    selectedDurationMonths: input.selectedDurationMonths,
    firstInstallmentDelayDays: input.firstInstallmentDelayDays,
    failedRules,
  });

  const nearestAlternatives: AlternativeScenario[] = [];
  const end = calculateFinancingEndDate({
    calculationDate: input.calculationDate,
    durationMonths: input.selectedDurationMonths,
    firstInstallmentDelayDays: input.firstInstallmentDelayDays,
  });
  const endLabel = formatItDateExport(end);

  if (
    input.patient.employmentType === "temporary_employee" &&
    input.patient.temporaryContractExpiry !== undefined &&
    end > input.patient.temporaryContractExpiry
  ) {
    nearestAlternatives.push({
      type: "renew_contract",
      durationMonths: input.selectedDurationMonths,
      requiredContractValidUntil: endLabel,
      explanation: `Una soluzione a ${input.selectedDurationMonths} mesi potrebbe diventare valutabile se il contratto risultasse valido almeno fino al ${endLabel}.`,
      certainty: "requires_verification",
    });
  }

  if (
    input.patient.isNonEuCitizen &&
    !input.patient.hasResidencePermitRenewalReceiptOnly &&
    input.patient.residencePermitExpiry !== undefined &&
    end > input.patient.residencePermitExpiry
  ) {
    nearestAlternatives.push({
      type: "renew_residence_permit",
      durationMonths: input.selectedDurationMonths,
      requiredPermitValidUntil: endLabel,
      explanation: `Una soluzione a ${input.selectedDurationMonths} mesi potrebbe diventare valutabile se il permesso di soggiorno risultasse valido almeno fino al ${endLabel}.`,
      certainty: "requires_verification",
    });
  }

  if (
    blockingConstraints.some(
      (item) =>
        item.type === "temporary_contract_expiry" ||
        item.type === "residence_permit_expiry",
    )
  ) {
    nearestAlternatives.push({
      type: "lower_amount",
      requiredAmountMax: input.requestedAmount,
      explanation:
        "La riduzione dell’importo può essere valutata solo dopo aver risolto i vincoli temporali (contratto/permesso), se a quel punto esistessero prodotti con durata compatibile.",
      certainty: "requires_verification",
    });
  }

  const informationalSuggestions: InformationalSuggestion[] = [];
  if (
    input.patient.employmentType === "temporary_employee" ||
    input.patient.employmentType === "student" ||
    input.patient.employmentType === "housewife"
  ) {
    informationalSuggestions.push({
      type: "guarantor",
      message:
        "Può essere utile valutare un garante secondo le regole della finanziaria. Il garante non risolve automaticamente il vincolo del permesso di soggiorno né la scadenza del contratto.",
    });
  }

  return {
    version: ALTERNATIVE_DIAGNOSTICS_VERSION,
    hasCompatibleSolutions: false,
    verificationRequiredCount,
    blockingConstraints,
    primaryConstraint,
    nearestAlternatives,
    informationalSuggestions,
    documentationRequirements,
  };
}

/**
 * Preferisce lo snapshot persistito; altrimenti ricostruisce dai dati fotografati.
 */
export function resolveComparisonDiagnostics(input: {
  persistedDiagnostics?: ComparisonDiagnostics | null;
  hasCompatibleSolutions: boolean;
  verificationRequiredCount?: number;
  calculationDate: number;
  requestedAmount: number;
  selectedDurationMonths: number;
  firstInstallmentDelayDays: number;
  patient: PatientFinancialProfile;
  solutions: PersistedSolutionForDiagnostics[];
}): ComparisonDiagnostics | null {
  if (input.hasCompatibleSolutions) {
    return null;
  }

  if (
    input.persistedDiagnostics &&
    input.persistedDiagnostics.hasCompatibleSolutions === false
  ) {
    const verificationRequiredCount =
      input.persistedDiagnostics.verificationRequiredCount ??
      input.verificationRequiredCount ??
      input.solutions.filter(
        (item) => item.resultGroup === "verification_required",
      ).length;
    return {
      ...input.persistedDiagnostics,
      verificationRequiredCount,
    };
  }

  return buildDiagnosticsFromPersistedComparison({
    hasCompatibleSolutions: false,
    verificationRequiredCount: input.verificationRequiredCount,
    calculationDate: input.calculationDate,
    requestedAmount: input.requestedAmount,
    selectedDurationMonths: input.selectedDurationMonths,
    firstInstallmentDelayDays: input.firstInstallmentDelayDays,
    patient: input.patient,
    solutions: input.solutions,
  });
}
