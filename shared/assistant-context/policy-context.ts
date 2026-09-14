import type { EntityCatalogItem, MatchedEntities } from "./types.ts";

export type PolicyContextInput = {
  matched: MatchedEntities;
  policies: Array<{
    id: string;
    name: string;
    network: "PCG" | "DES" | "Paoleschi";
    companyId?: string;
    productId?: string;
    financialTableId?: string;
    rules: Array<{ ruleType: string; message?: string; summary?: string }>;
  }>;
  tables: Array<{
    id: string;
    tableCode: string;
    displayName: string;
    network: "PCG" | "DES" | "Paoleschi";
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
    network: "PCG" | "DES" | "Paoleschi";
  }>;
}): EntityCatalogItem[] {
  const catalog: EntityCatalogItem[] = [];
  for (const company of input.companies) {
    catalog.push({
      kind: "company",
      id: company.id,
      labels: uniqueLabels([
        company.name,
        company.shortName,
        ...deriveInitialsAliases(company.name, company.shortName),
      ]),
    });
  }
  for (const product of input.products) {
    catalog.push({
      kind: "product",
      id: product.id,
      companyId: product.companyId,
      labels: uniqueLabels([product.name, product.code]),
    });
  }
  for (const table of input.tables) {
    catalog.push({
      kind: "table",
      id: table.id,
      companyId: table.companyId,
      productId: table.productId,
      network: table.network,
      labels: uniqueLabels([table.tableCode, table.displayName]),
    });
  }
  return catalog;
}

/** Alias tecnici da iniziali multi-parola (es. "Deutsche Bank" → "DB"). */
function deriveInitialsAliases(...labels: string[]): string[] {
  const aliases: string[] = [];
  for (const label of labels) {
    const parts = label
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);
    if (parts.length < 2) continue;
    const initials = parts
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase();
    if (initials.length >= 2) {
      aliases.push(initials);
    }
  }
  return aliases;
}

function uniqueLabels(values: Array<string | undefined | null>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || !value.trim()) continue;
    const key = value.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value.trim());
  }
  return result;
}
