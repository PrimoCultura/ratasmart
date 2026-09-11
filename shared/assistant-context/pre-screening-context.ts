import { resolveTableDurationMonths } from "../table-durations.ts";
import { normalizeText } from "../knowledge-engine/normalize.ts";
import type { MatchedEntities } from "./types.ts";
import type { PreScreeningIntent } from "./intents.ts";
import {
  buildPreScreeningOrientation,
  extractPreScreeningSignals,
  resolveCompanyPreScreeningStatuses,
} from "./pre-screening-guidance.ts";

export type PreScreeningCompany = {
  id: string;
  name: string;
  shortName: string;
};

export type PreScreeningProduct = {
  id: string;
  companyId: string;
  name: string;
  code?: string;
  category?: string;
};

export type PreScreeningTable = {
  id: string;
  companyId: string;
  productId: string;
  tableCode: string;
  displayName: string;
  category: string;
  network: "PCG" | "DES";
  minimumAmount: number;
  maximumAmount: number;
  allowedDurations: number[];
  firstInstallmentDelayDays: number[];
  customerTanPercent: number;
};

export type PreScreeningPolicyRule = {
  companyId: string;
  companyName?: string;
  companyShortName?: string;
  productId?: string;
  productName?: string;
  financialTableId?: string;
  tableCode?: string;
  network: "PCG" | "DES";
  policySetName: string;
  ruleType: string;
  operator: string;
  numericValue?: number;
  stringValue?: string;
  booleanValue?: boolean;
  stringValues?: string[];
  monthsBuffer?: number;
  failureMessage: string;
  verificationMessage?: string;
};

export type PreScreeningContext = {
  detectedIntents: PreScreeningIntent[];
  network: "PCG" | "DES";
  companies: PreScreeningCompany[];
  products: PreScreeningProduct[];
  tables: PreScreeningTable[];
  policyRules: PreScreeningPolicyRule[];
  matchedLabels: string[];
  warnings: string[];
};

export type PreScreeningSourceData = {
  network: "PCG" | "DES";
  companies: PreScreeningCompany[];
  products: Array<
    PreScreeningProduct & {
      isActive?: boolean;
    }
  >;
  tables: Array<{
    id: string;
    companyId: string;
    productId: string;
    tableCode: string;
    displayName: string;
    category: string;
    network: "PCG" | "DES";
    minimumAmount: number;
    maximumAmount: number;
    minimumDurationMonths: number;
    maximumDurationMonths: number;
    durationStepMonths: number;
    durationTerms?: Array<{ durationMonths: number }> | null;
    firstInstallmentDelayDays: number[];
    customerTanPercent: number;
    isActive?: boolean;
  }>;
  policySets: Array<{
    id: string;
    name: string;
    network: "PCG" | "DES";
    companyId: string;
    productId?: string;
    financialTableId?: string;
    isActive: boolean;
    validFrom?: number;
    validTo?: number;
  }>;
  policyRules: Array<{
    policySetId: string;
    ruleType: string;
    operator: string;
    numericValue?: number;
    stringValue?: string;
    booleanValue?: boolean;
    stringValues?: string[];
    monthsBuffer?: number;
    failureMessage: string;
    verificationMessage?: string;
    isActive: boolean;
    sortOrder: number;
  }>;
  calculationDate?: number;
};

const AGE_RULES = new Set([
  "minimum_age",
  "maximum_age_at_application",
  "maximum_age_at_end",
]);

const EMPLOYMENT_RULES = new Set([
  "employment_type_allowed",
  "temporary_contract_expiry",
  "pensioner_allowed",
  "minimum_employment_seniority_months",
  "maximum_amount_for_employment_types",
  "guarantor_required_for_employment_types",
]);

const RESIDENCE_RULES = new Set([
  "non_eu_allowed",
  "residence_permit_expiry",
  "renewal_receipt_allowed",
]);

const AMOUNT_RULES = new Set([
  "minimum_amount",
  "maximum_amount",
  "maximum_amount_for_employment_types",
]);
const DURATION_RULES = new Set(["minimum_duration", "maximum_duration"]);

const CORE_RULES_FOR_GENERIC = new Set([
  ...AGE_RULES,
  ...EMPLOYMENT_RULES,
  ...RESIDENCE_RULES,
  ...AMOUNT_RULES,
  ...DURATION_RULES,
  "pensioner_allowed",
]);

function isValidAt(
  now: number,
  validFrom?: number,
  validTo?: number,
): boolean {
  if (validFrom !== undefined && now < validFrom) return false;
  if (validTo !== undefined && now > validTo) return false;
  return true;
}

function ruleTypesForIntents(intents: PreScreeningIntent[]): Set<string> | null {
  if (intents.includes("generic")) {
    return CORE_RULES_FOR_GENERIC;
  }

  const types = new Set<string>();
  for (const intent of intents) {
    if (intent === "age") {
      AGE_RULES.forEach((item) => types.add(item));
      // età a fine piano interagisce con la durata
      DURATION_RULES.forEach((item) => types.add(item));
    }
    if (intent === "amount") {
      AMOUNT_RULES.forEach((item) => types.add(item));
    }
    if (intent === "duration") {
      DURATION_RULES.forEach((item) => types.add(item));
      AGE_RULES.forEach((item) => types.add(item));
    }
    if (intent === "employment") {
      EMPLOYMENT_RULES.forEach((item) => types.add(item));
    }
    if (intent === "residence_permit") {
      RESIDENCE_RULES.forEach((item) => types.add(item));
    }
    if (intent === "pensioner") {
      types.add("pensioner_allowed");
      AGE_RULES.forEach((item) => types.add(item));
      EMPLOYMENT_RULES.forEach((item) => types.add(item));
    }
    if (
      intent === "guarantor" ||
      intent === "documents" ||
      intent === "product" ||
      intent === "company"
    ) {
      // Policy formali core + eventuali custom legate all'entità
      CORE_RULES_FOR_GENERIC.forEach((item) => types.add(item));
      types.add("custom");
    }
  }
  return types;
}

function includeTablesForIntents(intents: PreScreeningIntent[]): boolean {
  if (intents.includes("generic")) return true;
  return intents.some((intent) =>
    ["amount", "duration", "product", "company", "age"].includes(intent),
  );
}

function includeProductsForIntents(intents: PreScreeningIntent[]): boolean {
  if (intents.includes("generic")) return true;
  return intents.some((intent) =>
    ["product", "company", "amount", "duration", "age", "pensioner"].includes(
      intent,
    ),
  );
}

/**
 * Costruisce e filtra il contesto di pre-screening dai soli dati attivi Convex.
 * Nessun limite numerico hardcodato: i valori arrivano dal database.
 */
export function buildPreScreeningContext(input: {
  intents: PreScreeningIntent[];
  matched: MatchedEntities;
  source: PreScreeningSourceData;
  question?: string;
  maxCharacters?: number;
}): PreScreeningContext {
  const warnings: string[] = [];
  const now = input.source.calculationDate ?? Date.now();
  const network = input.source.network;

  const companyById = new Map(
    input.source.companies.map((company) => [company.id, company]),
  );
  const productById = new Map(
    input.source.products.map((product) => [product.id, product]),
  );
  const tableById = new Map(
    input.source.tables.map((table) => [table.id, table]),
  );

  const activeTables = input.source.tables
    .filter((table) => table.network === network)
    .filter((table) => table.isActive !== false)
    .map((table): PreScreeningTable => ({
      id: table.id,
      companyId: table.companyId,
      productId: table.productId,
      tableCode: table.tableCode,
      displayName: table.displayName,
      category: table.category,
      network: table.network,
      minimumAmount: table.minimumAmount,
      maximumAmount: table.maximumAmount,
      allowedDurations: resolveTableDurationMonths({
        minimumDurationMonths: table.minimumDurationMonths,
        maximumDurationMonths: table.maximumDurationMonths,
        durationStepMonths: table.durationStepMonths,
        durationTerms: table.durationTerms,
      }),
      firstInstallmentDelayDays: table.firstInstallmentDelayDays,
      customerTanPercent: table.customerTanPercent,
    }));

  const activeProductIds = new Set(activeTables.map((table) => table.productId));
  const activeCompanyIds = new Set(activeTables.map((table) => table.companyId));

  let products = input.source.products.filter(
    (product) =>
      product.isActive !== false && activeProductIds.has(product.id),
  );
  let companies = input.source.companies.filter((company) =>
    activeCompanyIds.has(company.id),
  );
  let tables = activeTables;

  const hasEntityMatch =
    input.matched.companyIds.length > 0 ||
    input.matched.productIds.length > 0 ||
    input.matched.tableIds.length > 0;

  if (hasEntityMatch) {
    tables = tables.filter(
      (table) =>
        input.matched.tableIds.includes(table.id) ||
        input.matched.productIds.includes(table.productId) ||
        input.matched.companyIds.includes(table.companyId),
    );
    const scopedCompanyIds = new Set(tables.map((table) => table.companyId));
    const scopedProductIds = new Set(tables.map((table) => table.productId));
    // Se match solo company senza tabelle (edge), tieni la company
    for (const companyId of input.matched.companyIds) {
      scopedCompanyIds.add(companyId);
    }
    for (const productId of input.matched.productIds) {
      scopedProductIds.add(productId);
      const product = productById.get(productId);
      if (product) scopedCompanyIds.add(product.companyId);
    }
    companies = companies.filter((company) => scopedCompanyIds.has(company.id));
    products = products.filter((product) => scopedProductIds.has(product.id));
  }

  if (!includeTablesForIntents(input.intents) && !hasEntityMatch) {
    tables = [];
  }
  if (!includeProductsForIntents(input.intents) && !hasEntityMatch) {
    products = [];
  }

  const allowedRuleTypes = ruleTypesForIntents(input.intents);

  const validSets = input.source.policySets.filter(
    (set) =>
      set.isActive &&
      set.network === network &&
      isValidAt(now, set.validFrom, set.validTo),
  );

  const scopedCompanyIds = new Set(companies.map((company) => company.id));
  const scopedProductIds = new Set(products.map((product) => product.id));
  const scopedTableIds = new Set(tables.map((table) => table.id));

  const rules: PreScreeningPolicyRule[] = [];
  for (const set of validSets) {
    const inScope =
      scopedCompanyIds.has(set.companyId) ||
      (set.productId !== undefined && scopedProductIds.has(set.productId)) ||
      (set.financialTableId !== undefined &&
        scopedTableIds.has(set.financialTableId));
    if (!inScope) {
      continue;
    }

    if (hasEntityMatch) {
      const matchesEntity =
        input.matched.companyIds.includes(set.companyId) ||
        (set.productId !== undefined &&
          input.matched.productIds.includes(set.productId)) ||
        (set.financialTableId !== undefined &&
          input.matched.tableIds.includes(set.financialTableId)) ||
        scopedCompanyIds.has(set.companyId);
      if (!matchesEntity) {
        continue;
      }
    }

    const setRules = input.source.policyRules
      .filter((rule) => rule.policySetId === set.id && rule.isActive)
      .filter(
        (rule) =>
          allowedRuleTypes === null ||
          allowedRuleTypes.has(rule.ruleType) ||
          (hasEntityMatch && rule.ruleType === "custom"),
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const company = companyById.get(set.companyId);
    const product = set.productId ? productById.get(set.productId) : undefined;
    const table = set.financialTableId
      ? tableById.get(set.financialTableId)
      : undefined;

    for (const rule of setRules) {
      rules.push({
        companyId: set.companyId,
        companyName: company?.name,
        companyShortName: company?.shortName,
        productId: set.productId,
        productName: product?.name,
        financialTableId: set.financialTableId,
        tableCode: table?.tableCode,
        network: set.network,
        policySetName: set.name,
        ruleType: rule.ruleType,
        operator: rule.operator,
        numericValue: rule.numericValue,
        stringValue: rule.stringValue,
        booleanValue: rule.booleanValue,
        stringValues: rule.stringValues,
        monthsBuffer: rule.monthsBuffer,
        failureMessage: rule.failureMessage,
        verificationMessage: rule.verificationMessage,
      });
    }
  }

  // Cap tabelle/rules per mantenere il contesto leggibile
  const maxTables = input.intents.includes("generic") ? 24 : 40;
  const maxRules = input.intents.includes("generic") ? 40 : 60;
  if (tables.length > maxTables) {
    warnings.push(
      `Pre-screening: mostrate ${maxTables}/${tables.length} tabelle per limite contesto.`,
    );
    tables = tables.slice(0, maxTables);
  }
  let policyRules = rules;
  if (policyRules.length > maxRules) {
    warnings.push(
      `Pre-screening: mostrate ${maxRules}/${policyRules.length} policy per limite contesto.`,
    );
    policyRules = policyRules.slice(0, maxRules);
  }

  // Applica esclusioni formali: tabelle solo tra finanziarie ancora valutabili.
  const signals = input.question
    ? extractPreScreeningSignals(input.question)
    : {};
  let context: PreScreeningContext = {
    detectedIntents: input.intents,
    network,
    companies,
    products,
    tables,
    policyRules,
    matchedLabels: input.matched.matchedLabels,
    warnings,
  };

  if (
    input.question &&
    (signals.isStudent ||
      signals.isHousewife ||
      signals.ageYears !== undefined ||
      signals.hasRenewalReceiptOnly ||
      signals.isTemporaryEmployee ||
      signals.requestedAmount !== undefined)
  ) {
    const statuses = resolveCompanyPreScreeningStatuses(context, signals);
    const excludedIds = new Set(
      statuses
        .filter((item) => item.status === "excluded" && item.companyId)
        .map((item) => item.companyId!),
    );

    if (excludedIds.size > 0) {
      tables = tables.filter((table) => !excludedIds.has(table.companyId));
      products = products.filter(
        (product) => !excludedIds.has(product.companyId),
      );
      // Mantieni tutte le companies per mostrare le ESCLUSE nell'orientamento.
    }

    if (signals.requestedAmount !== undefined) {
      tables = tables.filter(
        (table) =>
          table.minimumAmount <= signals.requestedAmount! &&
          table.maximumAmount >= signals.requestedAmount!,
      );
    }

    context = {
      ...context,
      products,
      tables,
      warnings,
    };
  }

  const formatted = formatPreScreeningContext(context, {
    question: input.question,
  });
  const maxChars = input.maxCharacters ?? 14_000;
  if (formatted.length > maxChars) {
    warnings.push("Contesto di pre-screening ridotto per limite caratteri.");
    context.tables = context.tables.slice(0, 12);
    context.policyRules = context.policyRules.slice(0, 20);
    context.warnings = warnings;
  }

  return context;
}

export function formatPreScreeningContext(
  context: PreScreeningContext,
  options?: { question?: string },
): string {
  const lines: string[] = [
    "CONTESTO PRE-SCREENING AZIENDALE (dati strutturati correnti)",
    `Rete: ${context.network}`,
    `Intent rilevati: ${context.detectedIntents.join(", ")}`,
  ];

  if (context.matchedLabels.length > 0) {
    lines.push(`Entità citate: ${context.matchedLabels.join(", ")}`);
  }

  lines.push(
    "",
    "Nota operativa: questo è un pre-screening formale, non una simulazione e non un calcolo rata/TAN/TAEG.",
  );

  if (options?.question) {
    const signals = extractPreScreeningSignals(options.question);
    const statuses = resolveCompanyPreScreeningStatuses(context, signals);
    const orientation = buildPreScreeningOrientation(
      context,
      signals,
      statuses,
    );
    if (orientation.length > 0) {
      lines.push("", ...orientation);
    }
  }

  if (context.companies.length > 0) {
    lines.push("", "Finanziarie attive nella rete:");
    for (const company of context.companies) {
      lines.push(`- ${company.shortName} (${company.name})`);
    }
  }

  if (context.tables.length > 0) {
    lines.push(
      "",
      "Tabelle finanziarie ancora valutabili (estratto; già filtrate da esclusioni policy e importo se noti):",
    );
    for (const table of context.tables) {
      const company =
        context.companies.find((item) => item.id === table.companyId)
          ?.shortName ?? table.companyId;
      const durations =
        table.allowedDurations.length <= 12
          ? table.allowedDurations.join(", ")
          : `${table.allowedDurations[0]}–${table.allowedDurations[table.allowedDurations.length - 1]} (${table.allowedDurations.length} opzioni)`;
      lines.push(
        `- ${company} · ${table.tableCode} · ${table.displayName} · categoria ${table.category} · importi ${table.minimumAmount}–${table.maximumAmount} € · durate mesi [${durations}] · prima rata giorni [${table.firstInstallmentDelayDays.join(", ")}]`,
      );
    }
  } else {
    lines.push(
      "",
      "Nessuna tabella ancora valutabile dopo le esclusioni formali / filtri importo per i dati disponibili nella domanda.",
    );
  }

  if (context.policyRules.length > 0) {
    lines.push("", "Policy strutturate attive (estratto):");
    for (const rule of context.policyRules) {
      const scope = [
        rule.companyShortName ?? rule.companyName,
        rule.productName,
        rule.tableCode,
      ]
        .filter(Boolean)
        .join(" / ");
      const valueParts = [
        rule.numericValue !== undefined ? `valore=${rule.numericValue}` : null,
        rule.stringValue ? `stringa=${rule.stringValue}` : null,
        rule.booleanValue !== undefined ? `bool=${rule.booleanValue}` : null,
        rule.stringValues && rule.stringValues.length > 0
          ? `lista=[${rule.stringValues.join(", ")}]`
          : null,
        rule.monthsBuffer !== undefined
          ? `buffer_mesi=${rule.monthsBuffer}`
          : null,
      ].filter(Boolean);
      lines.push(
        `- [${scope}] ${rule.ruleType} ${rule.operator}${valueParts.length ? ` (${valueParts.join("; ")})` : ""} → ${rule.failureMessage}${rule.verificationMessage ? ` | verifica: ${rule.verificationMessage}` : ""}`,
      );
    }
  } else {
    lines.push(
      "",
      "Nessuna policy strutturata attiva disponibile per gli intent/filtri correnti nel database.",
    );
  }

  if (context.warnings.length > 0) {
    lines.push("", "Avvisi contesto:");
    for (const warning of context.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join("\n");
}

/**
 * Domande procedurali risolvibili dalla Knowledge Base (liquidazione, fattura,
 * pagamenti, data rata, ecc.) non devono trascinare il pre-screening.
 */
export function isProceduralKnowledgeQuestion(question: string): boolean {
  const normalized = normalizeText(question);
  if (!normalized) return false;
  return (
    /\b(liquido|liquidare|liquidazione|erogare|erogazione|erogata)\b/.test(
      normalized,
    ) ||
    /\b(fattura|fatturazione|primoup|auto.?liquidazione)\b/.test(normalized) ||
    /\b(data\s+rata|addebito|postepay|metodi?\s+di\s+pagamento)\b/.test(
      normalized,
    ) ||
    /\b(procedura|come\s+si\s+liquida|come\s+liquido)\b/.test(normalized)
  );
}

const FINANCING_PRESCREENING_INTENTS: PreScreeningIntent[] = [
  "age",
  "amount",
  "duration",
  "employment",
  "residence_permit",
  "pensioner",
  "guarantor",
  "documents",
];

/**
 * Pre-screening per finanziabilità/requisiti.
 * Domande puramente procedurali KB: non attaccare pre-screening.
 */
export function shouldAttachPreScreening(input: {
  hasSimulationContext: boolean;
  intents: PreScreeningIntent[];
  matched: MatchedEntities;
  userQuestion?: string;
}): boolean {
  const question = input.userQuestion ?? "";
  const hasFinancingIntent = input.intents.some((intent) =>
    FINANCING_PRESCREENING_INTENTS.includes(intent),
  );

  if (isProceduralKnowledgeQuestion(question) && !hasFinancingIntent) {
    return false;
  }

  if (!input.hasSimulationContext) {
    return hasFinancingIntent;
  }

  if (
    input.matched.companyIds.length > 0 ||
    input.matched.productIds.length > 0 ||
    input.matched.tableIds.length > 0
  ) {
    return true;
  }

  const supplemental: PreScreeningIntent[] = [
    "residence_permit",
    "guarantor",
    "documents",
    "employment",
    "pensioner",
    "company",
    "product",
    "age",
  ];
  return input.intents.some((intent) => supplemental.includes(intent));
}

/** Privacy: il testo formattato non deve contenere identificativi o commerciali vietati. */
export function assertPreScreeningPrivacy(text: string): string[] {
  const forbidden = [
    "patientFirstName",
    "patientLastName",
    "firstName",
    "lastName",
    "codice fiscale",
    "codicefiscale",
    "iban",
    "provvigione",
    "rappel",
    "adminNotes",
    "clinicName",
  ];
  const lower = text.toLowerCase();
  return forbidden.filter((token) => lower.includes(token.toLowerCase()));
}
