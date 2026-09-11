import type { Doc } from "../../../../convex/_generated/dataModel";
import { PRODUCT_CATEGORY_LABELS } from "@/lib/constants/financial";
import type { ProductCategory } from "@/lib/constants/financial";

export type ComparisonSolution = Doc<"simulationComparisonSolutions">;

export function hasCompanyCostOrAuth(solution: ComparisonSolution): boolean {
  return (
    (solution.calculationSummary?.internalCostAmount ?? 0) > 0 ||
    solution.requiresManagerAuthorizationNotice
  );
}

export function solutionCategoryLabel(solution: ComparisonSolution): string {
  const category =
    (solution.productSnapshot.category as ProductCategory) ||
    (solution.financialTableSnapshot.category as ProductCategory);
  return PRODUCT_CATEGORY_LABELS[category] ?? category;
}

export function primaryIncompatibilityReason(
  solution: ComparisonSolution,
): string {
  const tech = solution.technicalExclusionReasons[0];
  if (tech) return tech;

  const failed = solution.compatibilitySnapshot.failedRules[0];
  if (failed) {
    return failed.message ?? failed.technicalReason ?? failed.ruleType;
  }

  const reason = solution.compatibilitySnapshot.reasons[0];
  if (reason) return reason;

  return "Condizioni non soddisfatte";
}

export function primaryVerificationReason(
  solution: ComparisonSolution,
): string {
  const rule = solution.compatibilitySnapshot.verificationRules[0];
  if (rule) {
    return rule.message ?? rule.technicalReason ?? rule.ruleType;
  }
  const reason = solution.compatibilitySnapshot.verificationReasons[0];
  if (reason) return reason;
  return "Verifica manuale richiesta";
}
