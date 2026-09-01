import type { Doc } from "../_generated/dataModel";
import type {
  PolicyOperator,
  PolicyRuleType,
  PolicyScope,
  RuntimePolicyRule,
} from "../../shared/policy-engine/types";

export function mapPolicyRuleToRuntime(
  rule: Doc<"policyRules">,
  policySet: Doc<"policySets">,
): RuntimePolicyRule {
  const scope: PolicyScope = policySet.financialTableId
    ? "financial_table"
    : policySet.productId
      ? "product"
      : "company";

  return {
    id: rule._id,
    policySetId: rule.policySetId,
    scope,
    ruleType: rule.ruleType as PolicyRuleType,
    operator: rule.operator as PolicyOperator,
    numericValue: rule.numericValue,
    stringValue: rule.stringValue,
    booleanValue: rule.booleanValue,
    stringValues: rule.stringValues,
    monthsBuffer: rule.monthsBuffer,
    failureMessage: rule.failureMessage,
    verificationMessage: rule.verificationMessage,
    sortOrder: rule.sortOrder,
  };
}

const SCOPE_ORDER: Record<PolicyScope, number> = {
  company: 0,
  product: 1,
  financial_table: 2,
};

export function sortRuntimeRules(
  rules: RuntimePolicyRule[],
): RuntimePolicyRule[] {
  return [...rules].sort((a, b) => {
    const scopeDiff = SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope];
    if (scopeDiff !== 0) return scopeDiff;
    return a.sortOrder - b.sortOrder;
  });
}

/**
 * Raccoglie le regole attive applicabili a una tabella:
 * company + product + financial_table (sommate, senza override).
 */
export function collectRulesForTable(input: {
  table: Doc<"financialTables">;
  policySets: Doc<"policySets">[];
  policyRules: Doc<"policyRules">[];
  now: number;
  isCurrentlyValid: (
    now: number,
    validFrom?: number,
    validTo?: number,
  ) => boolean;
}): RuntimePolicyRule[] {
  const applicableSets = input.policySets.filter((set) => {
    if (!set.isActive) return false;
    if (set.network !== input.table.network) return false;
    if (!input.isCurrentlyValid(input.now, set.validFrom, set.validTo)) {
      return false;
    }

    if (set.financialTableId) {
      return set.financialTableId === input.table._id;
    }
    if (set.productId) {
      return (
        set.productId === input.table.productId &&
        set.companyId === input.table.companyId
      );
    }
    return set.companyId === input.table.companyId;
  });

  const setIds = new Set(applicableSets.map((set) => set._id));
  const setMap = new Map(applicableSets.map((set) => [set._id, set]));

  const rules = input.policyRules
    .filter(
      (rule) =>
        rule.isActive &&
        setIds.has(rule.policySetId) &&
        setMap.has(rule.policySetId),
    )
    .map((rule) =>
      mapPolicyRuleToRuntime(rule, setMap.get(rule.policySetId)!),
    );

  return sortRuntimeRules(rules);
}
