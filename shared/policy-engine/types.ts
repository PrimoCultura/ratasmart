export type EmploymentType =
  | "permanent_employee"
  | "temporary_employee"
  | "pensioner"
  | "self_employed"
  | "unemployed"
  | "student"
  | "housewife"
  | "other";

export type PatientFinancialProfile = {
  age: number;
  employmentType: EmploymentType;
  temporaryContractExpiry?: number;
  isNonEuCitizen: boolean;
  residencePermitExpiry?: number;
  /** Solo ricevuta di rinnovo del permesso (senza permesso in corso di validità). */
  hasResidencePermitRenewalReceiptOnly?: boolean;
  /** Anzianità lavorativa in mesi (tempo indeterminato). */
  /** ISO `YYYY-MM-DD` se nota; l’anzianità in mesi si deriva dalla referenceDate. */
  employmentStartDate?: string;
  employmentSeniorityMonths?: number;
  /** Presenza di un garante dichiarato dal CM. */
  hasGuarantor?: boolean;
};

export type CompatibilityStatus =
  | "compatible"
  | "verification_required"
  | "not_compatible";

export type PolicyScope = "company" | "product" | "financial_table";

export type PolicyRuleType =
  | "minimum_age"
  | "maximum_age_at_application"
  | "maximum_age_at_end"
  | "employment_type_allowed"
  | "temporary_contract_expiry"
  | "pensioner_allowed"
  | "non_eu_allowed"
  | "residence_permit_expiry"
  | "renewal_receipt_allowed"
  | "minimum_employment_seniority_months"
  | "maximum_amount_for_employment_types"
  | "guarantor_required_for_employment_types"
  | "minimum_amount"
  | "maximum_amount"
  | "minimum_duration"
  | "maximum_duration"
  | "custom";

export type PolicyOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "in"
  | "not_in"
  | "date_after_financing_end"
  | "date_after_application"
  | "custom";

export type RuntimePolicyRule = {
  id: string;
  policySetId: string;
  scope: PolicyScope;
  ruleType: PolicyRuleType;
  operator: PolicyOperator;
  numericValue?: number;
  stringValue?: string;
  booleanValue?: boolean;
  stringValues?: string[];
  monthsBuffer?: number;
  failureMessage: string;
  verificationMessage?: string;
  sortOrder: number;
};

export type RuleEvaluationStatus =
  | "passed"
  | "failed"
  | "verification_required"
  | "not_applicable";

export type RuleEvaluation = {
  ruleId: string;
  ruleType: PolicyRuleType;
  status: RuleEvaluationStatus;
  message?: string;
  technicalReason?: string;
};

export type CompatibilityEvaluation = {
  status: CompatibilityStatus;
  passedRules: RuleEvaluation[];
  failedRules: RuleEvaluation[];
  verificationRules: RuleEvaluation[];
  notApplicableRules: RuleEvaluation[];
  reasons: string[];
  verificationReasons: string[];
};

export type RuntimeFinancialSolution = {
  solutionId: string;
  companyId: string;
  companyName: string;
  companyShortName: string;
  productId: string;
  productName: string;
  financialTableId: string;
  financialTableVersion: number;
  tableCode: string;
  tableDisplayName: string;
  category: string;
  network: "PCG" | "DES";
  durationMonths: number;
  firstInstallmentDelayDays: number;
  calculation: import("../financial-engine/types.ts").FinancialCalculationResult | null;
  compatibility: CompatibilityEvaluation;
  isCompanyPriority: boolean;
  priorityScore: number;
  priorityLabel?: string;
  priorityVisibleReason?: string;
  internalMessageIds: string[];
  requiresManagerAuthorizationNotice: boolean;
  distanceFromTargetInstallment?: number;
  technicalExclusionReasons: string[];
  durationAlternatives?: Array<{
    durationMonths: number;
    calculation: import("../financial-engine/types.ts").FinancialCalculationResult | null;
    compatibility: CompatibilityEvaluation;
    technicalExclusionReasons: string[];
  }>;
  durationTermSnapshot?: {
    durationMonths: number;
    minimumAmount: number;
    maximumAmount: number;
    customerTanPercent: number;
    internalCostPercent?: number;
  };
};

export type SimulationComparisonResult = {
  simulationId: string;
  calculationDate: number;
  network: "PCG" | "DES";
  selectedDurationMonths: number;
  selectedFirstInstallmentDelayDays: number;
  targetInstallment?: number;
  compatibleSolutions: RuntimeFinancialSolution[];
  verificationRequiredSolutions: RuntimeFinancialSolution[];
  incompatibleSolutions: RuntimeFinancialSolution[];
  availableComparisonDurations: number[];
  nearestTargetSolutionId?: string;
  disclaimer: string;
  fiscalWarning: string;
  warnings: string[];
};

export const FORMAL_COMPATIBILITY_DISCLAIMER =
  "La compatibilità indicata riguarda esclusivamente i requisiti formali conosciuti. L’approvazione, il rifiuto e le condizioni definitive della pratica dipendono esclusivamente dalla società finanziaria.";

export const FISCAL_WARNING =
  "Alla prima rata potrà essere aggiunto l’onere fiscale previsto dalla normativa applicabile. Il bollo e l’imposta sostitutiva non sono ancora inclusi nel calcolo.";
