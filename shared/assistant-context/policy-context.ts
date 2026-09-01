import type { EntityCatalogItem, MatchedEntities } from "./types.ts";

export type PolicyContextInput = {
  matched: MatchedEntities;
  policies: Array<{
    id: string;
    name: string;
    network: "PCG" | "DES";
    companyId?: string;
    productId?: string;
    financialTableId?: string;
    rules: Array<{ ruleType: string; message?: string; summary?: string }>;
  }>;
  tables: Array<{
    id: string;
    tableCode: string;
    displayName: string;
    network: "PCG" | "DES";
    companyId: string;
    productId: string;
    customerTanPercent: number;
    minimumAmount: number;
    maximumAmount: number;
    minimumDurationMonths: number;
    maximumDurationMonths: number;
  }>;
  maxCharacters?: number;
};

/**
 * Contesto policy/tabelle ridotto: solo entità riconosciute.
 * Se nessuna entità, restituisce stringa vuota (usa knowledge generali).
 */
export function buildPolicyAndTableContext(input: PolicyContextInput): {
  text: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const hasMatch =
    input.matched.companyIds.length > 0 ||
    input.matched.productIds.length > 0 ||
    input.matched.tableIds.length > 0;

  if (!hasMatch) {
    return { text: "", warnings };
  }

  const lines: string[] = ["CONTESTO POLICY E TABELLE PERTINENTI"];
  if (input.matched.matchedLabels.length > 0) {
    lines.push(`Entità riconosciute: ${input.matched.matchedLabels.join(", ")}`);
  }

  const tables = input.tables.filter(
    (table) =>
      input.matched.tableIds.includes(table.id) ||
      input.matched.productIds.includes(table.productId) ||
      input.matched.companyIds.includes(table.companyId),
  );

  if (tables.length > 0) {
    lines.push("", "Tabelle:");
    for (const table of tables.slice(0, 8)) {
      lines.push(
        `- ${table.tableCode} (${table.displayName}) rete ${table.network}: TAN ${table.customerTanPercent}%, importi ${table.minimumAmount}–${table.maximumAmount}, durate ${table.minimumDurationMonths}–${table.maximumDurationMonths}`,
      );
    }
  }

  const policies = input.policies.filter(
    (policy) =>
      (policy.financialTableId &&
        input.matched.tableIds.includes(policy.financialTableId)) ||
      (policy.productId && input.matched.productIds.includes(policy.productId)) ||
      (policy.companyId && input.matched.companyIds.includes(policy.companyId)),
  );

  if (policies.length > 0) {
    lines.push("", "Policy:");
    for (const policy of policies.slice(0, 8)) {
      const ruleSummaries = policy.rules
        .slice(0, 6)
        .map(
          (rule) =>
            rule.summary ?? rule.message ?? rule.ruleType,
        )
        .join("; ");
      lines.push(`- ${policy.name} (${policy.network}): ${ruleSummaries}`);
    }
  }

  let text = lines.join("\n");
  const max = input.maxCharacters ?? 6_000;
  if (text.length > max) {
    warnings.push("Contesto policy ridotto per limite caratteri.");
    text = "";
  }

  return { text, warnings };
}

export function buildEntityCatalogFromActiveData(input: {
  companies: Array<{ id: string; name: string; shortName: string }>;
  products: Array<{
    id: string;
    companyId: string;
    name: string;
    code?: string;
  }>;
  tables: Array<{
    id: string;
    companyId: string;
    productId: string;
    tableCode: string;
    displayName: string;
    network: "PCG" | "DES";
  }>;
}): EntityCatalogItem[] {
  const catalog: EntityCatalogItem[] = [];
  for (const company of input.companies) {
    catalog.push({
      kind: "company",
      id: company.id,
      labels: [company.name, company.shortName].filter(Boolean),
    });
  }
  for (const product of input.products) {
    catalog.push({
      kind: "product",
      id: product.id,
      companyId: product.companyId,
      labels: [product.name, product.code].filter(
        (value): value is string => Boolean(value),
      ),
    });
  }
  for (const table of input.tables) {
    catalog.push({
      kind: "table",
      id: table.id,
      companyId: table.companyId,
      productId: table.productId,
      network: table.network,
      labels: [table.tableCode, table.displayName].filter(Boolean),
    });
  }
  return catalog;
}
