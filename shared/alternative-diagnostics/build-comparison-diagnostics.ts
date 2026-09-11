import type { RuntimeFinancialTable } from "../policy-engine/comparison.ts";
import type {
  PatientFinancialProfile,
  RuntimeFinancialSolution,
  RuntimePolicyRule,
} from "../policy-engine/types.ts";
import {
  analyzeBlockingConstraints,
  type FailedRuleSignal,
} from "./analyze-failure-reasons.ts";
import {
  ALTERNATIVE_DIAGNOSTICS_VERSION,
  type ComparisonDiagnostics,
  type InformationalSuggestion,
} from "./diagnostic-types.ts";
import {
  findAlternativeScenarios,
  noDurationFitsTemporalWindow,
} from "./find-alternative-scenarios.ts";

export type DiagnosticsBuildInput = {
  calculationDate: number;
  requestedAmount: number;
  selectedDurationMonths: number;
  firstInstallmentDelayDays: number;
  patient: PatientFinancialProfile;
  compatibleSolutions: RuntimeFinancialSolution[];
  verificationRequiredSolutions: RuntimeFinancialSolution[];
  incompatibleSolutions: RuntimeFinancialSolution[];
  tables: RuntimeFinancialTable[];
  companyNameById: Record<string, string>;
  rulesByTableId: Record<string, RuntimePolicyRule[]>;
};

function collectFailedRules(
  solutions: RuntimeFinancialSolution[],
): FailedRuleSignal[] {
  const signals: FailedRuleSignal[] = [];
  for (const solution of solutions) {
    for (const rule of solution.compatibility.failedRules) {
      signals.push({
        ruleType: rule.ruleType,
        message: rule.message,
        companyShortName: solution.companyShortName,
        severity: "blocking",
      });
    }
    for (const rule of solution.compatibility.verificationRules) {
      signals.push({
        ruleType: rule.ruleType,
        message: rule.message,
        companyShortName: solution.companyShortName,
        severity: "verification",
      });
    }
  }
  return signals;
}

/**
 * Costruisce la diagnostica deterministica del confronto.
 */
export function buildComparisonDiagnostics(
  input: DiagnosticsBuildInput,
): ComparisonDiagnostics {
  const hasCompatibleSolutions = input.compatibleSolutions.length > 0;

  if (hasCompatibleSolutions) {
    return {
      version: ALTERNATIVE_DIAGNOSTICS_VERSION,
      hasCompatibleSolutions: true,
      blockingConstraints: [],
      nearestAlternatives: [],
      informationalSuggestions: [],
    };
  }

  const { blockingConstraints, primaryConstraint } = analyzeBlockingConstraints(
    {
      patient: input.patient,
      calculationDate: input.calculationDate,
      selectedDurationMonths: input.selectedDurationMonths,
      firstInstallmentDelayDays: input.firstInstallmentDelayDays,
      failedRules: collectFailedRules([
        ...input.incompatibleSolutions,
        ...input.verificationRequiredSolutions,
      ]),
    },
  );

  let nearestAlternatives = findAlternativeScenarios({
    requestedAmount: input.requestedAmount,
    selectedDurationMonths: input.selectedDurationMonths,
    delayDays: input.firstInstallmentDelayDays,
    calculationDate: input.calculationDate,
    patient: input.patient,
    tables: input.tables,
    companyNameById: input.companyNameById,
    rulesByTableId: input.rulesByTableId,
  });

  // Se nessuna durata tecnicamente ammessa rispetta il vincolo temporale
  // per l'importo richiesto, non proporre alternative economiche illusorie.
  const temporalBlocked = noDurationFitsTemporalWindow({
    requestedAmount: input.requestedAmount,
    delayDays: input.firstInstallmentDelayDays,
    calculationDate: input.calculationDate,
    patient: input.patient,
    tables: input.tables,
  });

  if (temporalBlocked) {
    // Stesso importo: nessuna durata entra nella finestra.
    // Mantieni solo alternative a importo ridotto e i rinnovi.
    nearestAlternatives = nearestAlternatives.filter(
      (item) =>
        item.type === "renew_contract" ||
        item.type === "renew_residence_permit" ||
        item.type === "lower_amount" ||
        item.type === "lower_amount_and_shorter_duration",
    );
  }

  // Limita i rinnovi alle durate più corte utili (max 2)
  const renewals = nearestAlternatives
    .filter(
      (item) =>
        item.type === "renew_contract" ||
        item.type === "renew_residence_permit",
    )
    .slice(0, 2);
  const economic = nearestAlternatives.filter(
    (item) =>
      item.type !== "renew_contract" &&
      item.type !== "renew_residence_permit",
  );
  nearestAlternatives = [...economic, ...renewals];

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
    blockingConstraints,
    primaryConstraint,
    nearestAlternatives,
    informationalSuggestions,
  };
}
