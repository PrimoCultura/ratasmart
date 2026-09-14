/**
 * Tipi serializzabili per snapshot immutabili di confronto (Fase 3C).
 * Allineati ai campi Convex di simulationComparisonRuns / Solutions.
 */

export type NetworkCode = "PCG" | "DES" | "Paoleschi";

export type EmploymentTypeSnapshot =
  | "permanent_employee"
  | "temporary_employee"
  | "pensioner"
  | "self_employed"
  | "unemployed"
  | "student"
  | "housewife"
  | "other";

export type OpeningFeeTypeSnapshot = "none" | "fixed" | "percentage";

export type InstallmentFeeTypeSnapshot =
  | "none"
  | "fixed"
  | "percentage_of_requested_amount";

export type InternalCostBaseSnapshot = "requested_amount" | "financed_amount";

export type ComparisonSource =
  | "initial_calculation"
  | "manual_recalculation";

export type ResultGroup =
  | "compatible"
  | "verification_required"
  | "not_compatible";

export type ComparisonStatus =
  | "not_started"
  | "calculated"
  | "solution_selected";

export type PatientSnapshot = {
  firstName: string;
  lastName: string;
  age: number;
  employmentType: EmploymentTypeSnapshot;
  temporaryContractExpiry?: number;
  isNonEuCitizen: boolean;
  residencePermitExpiry?: number;
  hasResidencePermitRenewalReceiptOnly?: boolean;
  employmentStartDate?: string;
  employmentSeniorityMonths?: number;
  /** Data di riferimento usata per calcolare l'anzianità (ms). */
  seniorityReferenceDate?: number;
  hasGuarantor?: boolean;
  patientRequestsZeroInterest?: boolean;
};

export type CompanySnapshot = {
  companyId: string;
  name: string;
  shortName: string;
};

export type ProductSnapshot = {
  productId: string;
  name: string;
  code?: string;
  category: string;
};

export type FinancialTableSnapshot = {
  financialTableId: string;
  version: number;
  tableCode: string;
  displayName: string;
  description?: string;
  network: NetworkCode;
  category: string;
  minimumAmount: number;
  maximumAmount: number;
  minimumDurationMonths: number;
  maximumDurationMonths: number;
  durationStepMonths: number;
  durationTerms?: Array<{
    durationMonths: number;
    minimumAmount: number;
    maximumAmount: number;
    customerTanPercent?: number;
    internalCostPercent?: number;
  }>;
  customerTanPercent: number;
  openingFeeType: OpeningFeeTypeSnapshot;
  openingFeeValue: number;
  collectionFeePerInstallment: number;
  installmentFeeType?: InstallmentFeeTypeSnapshot;
  installmentFeeValue?: number;
  internalCostPercentAt24Months?: number;
  internalCostBase?: InternalCostBaseSnapshot;
  activeCommissionPercent?: number;
  activeCommissionBase?: "requested_amount";
  supportedFirstInstallmentDelayDays: number[];
  requiresManagerAuthorizationNotice: boolean;
};

export type DurationTermSnapshot = {
  durationMonths: number;
  minimumAmount: number;
  maximumAmount: number;
  customerTanPercent: number;
  internalCostPercent?: number;
};

export type CalculationInputSnapshot = {
  requestedAmount: number;
  durationMonths: number;
  customerTanPercent: number;
  openingFeeType: OpeningFeeTypeSnapshot;
  openingFeeValue: number;
  collectionFeePerInstallment: number;
  installmentFeeType?: InstallmentFeeTypeSnapshot;
  installmentFeeValue?: number;
  /** Costo aziendale esatto fotografato (prioritario in rigenerazione). */
  internalCostPercentApplied?: number;
  internalCostPercentAt24Months?: number;
  internalCostBase?: InternalCostBaseSnapshot;
  activeCommissionPercent?: number;
  activeCommissionBase?: "requested_amount";
  firstInstallmentDelayDays: number;
};

export type CalculationSummarySnapshot = {
  openingFeeAmount: number;
  financedAmount: number;
  durationMonths: number;
  firstInstallmentDelayDays: number;
  customerTanPercent: number;
  regularBaseInstallmentAmount: number;
  collectionFeePerInstallment: number;
  installmentFeeType?: InstallmentFeeTypeSnapshot;
  installmentFeeValue?: number;
  regularTotalInstallmentAmount: number;
  finalTotalInstallmentAmount: number;
  taegPercent?: number;
  taegCalculationSucceeded: boolean;
  totalPrincipalRepaid: number;
  totalCustomerInterest: number;
  totalCollectionFees: number;
  totalCustomerRepayment: number;
  totalCustomerCosts: number;
  internalCostBase?: InternalCostBaseSnapshot;
  internalCostPercentApplied: number;
  internalCostAmount: number;
  netAmountPaidToCompany: number;
  activeCommissionPercent?: number;
  activeCommissionBase?: "requested_amount";
  activeCommissionAmount?: number;
  companyEconomicValue?: number;
};

export type RuleSnapshot = {
  ruleId: string;
  ruleType: string;
  message?: string;
  technicalReason?: string;
};

export type CompatibilitySnapshot = {
  status: ResultGroup;
  reasons: string[];
  verificationReasons: string[];
  passedRules: Array<{
    ruleId: string;
    ruleType: string;
    message?: string;
  }>;
  failedRules: RuleSnapshot[];
  verificationRules: RuleSnapshot[];
};

export type PrioritySnapshot = {
  isCompanyPriority: boolean;
  priorityScore: number;
  label?: string;
  visibleReason?: string;
};

export type InternalMessageSnapshot = {
  originalMessageId: string;
  title: string;
  message: string;
  messageType: string;
  iconType: string;
  requiresPrivacyConfirmation: boolean;
};

/** Campi del run derivati dal risultato runtime (senza Id Convex). */
export type ComparisonRunFields = {
  calculationDate: number;
  network: NetworkCode;
  selectedDurationMonths: number;
  selectedFirstInstallmentDelayDays: number;
  requestedAmount: number;
  targetInstallment?: number;
  patientSnapshot: PatientSnapshot;
  compatibleSolutionsCount: number;
  verificationRequiredSolutionsCount: number;
  incompatibleSolutionsCount: number;
  nearestTargetSolutionRuntimeId?: string;
  disclaimer: string;
  fiscalWarning: string;
  warnings: string[];
  engineVersion: string;
  policyEngineVersion: string;
  source: ComparisonSource;
};

/** Campi soluzione persistente (senza Id Convex / flag proposta). */
export type PersistentSolutionFields = {
  runtimeSolutionId: string;
  resultGroup: ResultGroup;
  rankPosition: number;
  companySnapshot: CompanySnapshot;
  productSnapshot: ProductSnapshot;
  financialTableSnapshot: FinancialTableSnapshot;
  durationTermSnapshot?: DurationTermSnapshot;
  calculationInputSnapshot: CalculationInputSnapshot;
  calculationSummary?: CalculationSummarySnapshot;
  compatibilitySnapshot: CompatibilitySnapshot;
  technicalExclusionReasons: string[];
  prioritySnapshot: PrioritySnapshot;
  internalMessagesSnapshot: InternalMessageSnapshot[];
  requiresManagerAuthorizationNotice: boolean;
  distanceFromTargetInstallment?: number;
};

export type MessagePayloadForSnapshot = {
  id: string;
  title: string;
  message: string;
  messageType: string;
  iconType: string;
  requiresPrivacyConfirmation?: boolean;
};

export type TableMetadataForSnapshot = {
  id: string;
  version: number;
  tableCode: string;
  displayName: string;
  description?: string;
  network: NetworkCode;
  category: string;
  minimumAmount: number;
  maximumAmount: number;
  minimumDurationMonths: number;
  maximumDurationMonths: number;
  durationStepMonths: number;
  durationTerms?: Array<{
    durationMonths: number;
    minimumAmount: number;
    maximumAmount: number;
    customerTanPercent?: number;
    internalCostPercent?: number;
  }>;
  customerTanPercent: number;
  openingFeeType: OpeningFeeTypeSnapshot;
  openingFeeValue: number;
  collectionFeePerInstallment: number;
  installmentFeeType?: InstallmentFeeTypeSnapshot;
  installmentFeeValue?: number;
  internalCostPercentAt24Months?: number;
  internalCostBase?: InternalCostBaseSnapshot;
  activeCommissionPercent?: number;
  activeCommissionBase?: "requested_amount";
  firstInstallmentDelayDays: number[];
  requiresManagerAuthorizationNotice: boolean;
};

export type ProductMetadataForSnapshot = {
  id: string;
  name: string;
  code?: string;
  category?: string;
};
