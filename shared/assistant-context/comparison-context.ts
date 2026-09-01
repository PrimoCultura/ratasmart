import type { AnonymizedSolutionSummary } from "./types.ts";

/**
 * Converte uno snapshot soluzione Convex in summary anonimo.
 * Non include firstName/lastName/clinicName.
 */
export function mapSolutionSnapshotToSummary(solution: {
  companySnapshot: { name: string; shortName: string };
  productSnapshot: { name: string; code?: string };
  financialTableSnapshot: {
    tableCode: string;
    displayName: string;
    customerTanPercent: number;
  };
  resultGroup: "compatible" | "verification_required" | "not_compatible";
  compatibilitySnapshot: {
    reasons: string[];
    verificationReasons: string[];
  };
  technicalExclusionReasons: string[];
  calculationSummary?: {
    regularTotalInstallmentAmount: number;
    taegPercent?: number;
    financedAmount: number;
    durationMonths: number;
    internalCostAmount: number;
    netAmountPaidToCompany: number;
  };
  prioritySnapshot: {
    isCompanyPriority: boolean;
    priorityScore: number;
    label?: string;
    visibleReason?: string;
  };
  internalMessagesSnapshot: Array<{
    title: string;
    message: string;
    messageType: string;
  }>;
  requiresManagerAuthorizationNotice: boolean;
  distanceFromTargetInstallment?: number;
}): AnonymizedSolutionSummary {
  return {
    companyShortName: solution.companySnapshot.shortName,
    companyName: solution.companySnapshot.name,
    productName: solution.productSnapshot.name,
    productCode: solution.productSnapshot.code,
    tableCode: solution.financialTableSnapshot.tableCode,
    tableDisplayName: solution.financialTableSnapshot.displayName,
    resultGroup: solution.resultGroup,
    reasons: solution.compatibilitySnapshot.reasons,
    verificationReasons: solution.compatibilitySnapshot.verificationReasons,
    technicalExclusionReasons: solution.technicalExclusionReasons,
    regularTotalInstallmentAmount:
      solution.calculationSummary?.regularTotalInstallmentAmount,
    taegPercent: solution.calculationSummary?.taegPercent,
    customerTanPercent: solution.financialTableSnapshot.customerTanPercent,
    durationMonths: solution.calculationSummary?.durationMonths,
    financedAmount: solution.calculationSummary?.financedAmount,
    distanceFromTargetInstallment: solution.distanceFromTargetInstallment,
    priorityScore: solution.prioritySnapshot.priorityScore,
    priorityLabel: solution.prioritySnapshot.label,
    priorityVisibleReason: solution.prioritySnapshot.visibleReason,
    isCompanyPriority: solution.prioritySnapshot.isCompanyPriority,
    internalCostAmount: solution.calculationSummary?.internalCostAmount,
    netAmountPaidToCompany: solution.calculationSummary?.netAmountPaidToCompany,
    internalMessages: solution.internalMessagesSnapshot.map((item) => ({
      title: item.title,
      message: item.message,
      messageType: item.messageType,
    })),
    requiresManagerAuthorizationNotice:
      solution.requiresManagerAuthorizationNotice,
  };
}

export function buildComparisonContextSection(text: string): string {
  return text.trim().length > 0 ? text : "";
}
