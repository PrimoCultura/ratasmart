import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  fingerprintPolicyRules,
  PCG_FINANCING_POLICY_SETS_2026,
  type PcgPolicyRuleSeed,
} from "./pcgFinancingPolicies2026Data";
import {
  PCG_KNOWLEDGE_CARDS_2026,
  PCG_KB_SOURCE_REFERENCE,
  type OfficialKnowledgeCardSeed,
} from "../../shared/knowledge-engine/officialPcgCards2026";
import { normalizeKeywords } from "../../shared/knowledge-engine/index";

export type PolicySeedSummary = {
  created: string[];
  skipped: string[];
  versioned: string[];
  deactivatedDemo: string[];
  warnings: string[];
};

function rulesMatchFingerprint(
  existingRules: Array<{
    ruleType: string;
    operator: string;
    numericValue?: number;
    stringValue?: string;
    booleanValue?: boolean;
    stringValues?: string[];
    monthsBuffer?: number;
    failureMessage: string;
    verificationMessage?: string;
    sortOrder: number;
    isActive: boolean;
  }>,
  seedRules: PcgPolicyRuleSeed[],
): boolean {
  const active = existingRules.filter((rule) => rule.isActive);
  if (active.length !== seedRules.length) return false;
  const existingFingerprint = fingerprintPolicyRules(
    active.map((rule) => ({
      ruleType: rule.ruleType as PcgPolicyRuleSeed["ruleType"],
      operator: rule.operator as PcgPolicyRuleSeed["operator"],
      numericValue: rule.numericValue,
      stringValue: rule.stringValue,
      booleanValue: rule.booleanValue,
      stringValues: rule.stringValues,
      monthsBuffer: rule.monthsBuffer,
      failureMessage: rule.failureMessage,
      verificationMessage: rule.verificationMessage,
      sortOrder: rule.sortOrder,
    })),
  );
  return existingFingerprint === fingerprintPolicyRules(seedRules);
}

async function insertRules(
  ctx: MutationCtx,
  policySetId: Id<"policySets">,
  rules: PcgPolicyRuleSeed[],
  now: number,
) {
  for (const rule of rules) {
    await ctx.db.insert("policyRules", {
      policySetId,
      ruleType: rule.ruleType,
      operator: rule.operator,
      numericValue: rule.numericValue,
      stringValue: rule.stringValue,
      booleanValue: rule.booleanValue,
      stringValues: rule.stringValues,
      monthsBuffer: rule.monthsBuffer,
      failureMessage: rule.failureMessage,
      verificationMessage: rule.verificationMessage,
      sortOrder: rule.sortOrder,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Seed idempotente policy PCG 2026.
 * Usa sourceReference come chiave stabile; versiona se le regole differiscono.
 */
export async function upsertPcgFinancingPolicies2026(
  ctx: MutationCtx,
  actorUserId: Id<"appUsers">,
): Promise<PolicySeedSummary> {
  const now = Date.now();
  const summary: PolicySeedSummary = {
    created: [],
    skipped: [],
    versioned: [],
    deactivatedDemo: [],
    warnings: [],
  };

  const companies = await ctx.db.query("financialCompanies").collect();
  const companyByShortName = new Map(
    companies.map((company) => [company.shortName, company]),
  );

  // Disattiva policy demo/conflittuali note (non snapshot).
  const allSets = await ctx.db.query("policySets").collect();
  for (const set of allSets) {
    const isDemo =
      set.name.toLowerCase().includes("demo") ||
      (set.sourceReference ?? "").toLowerCase().includes("demo") ||
      (set.description ?? "").toLowerCase().includes("demo tecnica");
    const overlapsPcg2026 =
      set.network === "PCG" &&
      set.isActive &&
      !PCG_FINANCING_POLICY_SETS_2026.some(
        (seed) => seed.sourceReference === set.sourceReference,
      ) &&
      (set.name.toLowerCase().includes("età") ||
        set.name.toLowerCase().includes("eta") ||
        set.name.toLowerCase().includes("compatibilità"));

    if (set.isActive && (isDemo || overlapsPcg2026)) {
      // Solo demo esplicite: non disattivare set admin personalizzati senza "demo"
      if (isDemo) {
        await ctx.db.patch(set._id, { isActive: false, updatedAt: now });
        summary.deactivatedDemo.push(set.name);
      }
    }
  }

  for (const seed of PCG_FINANCING_POLICY_SETS_2026) {
    const company = companyByShortName.get(seed.companyShortName);
    if (!company) {
      summary.warnings.push(
        `Società “${seed.companyShortName}” assente: eseguire prima i seed tabelle PCG 2026.`,
      );
      continue;
    }

    const existingForCompany = allSets.filter(
      (set) =>
        set.companyId === company._id &&
        set.network === "PCG" &&
        set.sourceReference === seed.sourceReference,
    );
    const active = existingForCompany
      .filter((set) => set.isActive)
      .sort((a, b) => b.version - a.version)[0];

    if (active) {
      const rules = await ctx.db
        .query("policyRules")
        .withIndex("by_policy_set", (q) => q.eq("policySetId", active._id))
        .collect();
      if (rulesMatchFingerprint(rules, seed.rules)) {
        summary.skipped.push(seed.name);
        continue;
      }

      await ctx.db.patch(active._id, { isActive: false, updatedAt: now });
      const maxVersion = existingForCompany.reduce(
        (max, item) => Math.max(max, item.version),
        0,
      );
      const newSetId = await ctx.db.insert("policySets", {
        companyId: company._id,
        network: "PCG",
        name: seed.name,
        description: seed.description,
        sourceReference: seed.sourceReference,
        isActive: true,
        version: maxVersion + 1,
        supersedesPolicySetId: active._id,
        createdByUserId: actorUserId,
        createdAt: now,
        updatedAt: now,
      });
      await insertRules(ctx, newSetId, seed.rules, now);
      summary.versioned.push(`${seed.name} → v${maxVersion + 1}`);
      summary.warnings.push(
        `Policy “${seed.name}” versionata: le regole esistenti differivano dal seed ufficiale.`,
      );
      continue;
    }

    // Nessun set attivo con stesso sourceReference: crea
    const historical = existingForCompany;
    const maxVersion = historical.reduce(
      (max, item) => Math.max(max, item.version),
      0,
    );
    const newSetId = await ctx.db.insert("policySets", {
      companyId: company._id,
      network: "PCG",
      name: seed.name,
      description: seed.description,
      sourceReference: seed.sourceReference,
      isActive: true,
      version: maxVersion + 1,
      createdByUserId: actorUserId,
      createdAt: now,
      updatedAt: now,
    });
    await insertRules(ctx, newSetId, seed.rules, now);
    summary.created.push(seed.name);
  }

  return summary;
}

export type KnowledgeSeedSummary = {
  created: string[];
  skipped: string[];
  versioned: string[];
  deactivatedDemo: string[];
  warnings: string[];
};

function isDemoKnowledgeCard(card: {
  title: string;
  content: string;
}): boolean {
  return (
    card.title.includes("DEMO TECNICA") ||
    card.content.includes("NON USARE COME POLICY UFFICIALE")
  );
}

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function cardMatchesSeedPayload(
  card: Doc<"knowledgeCards">,
  seed: OfficialKnowledgeCardSeed,
  companyId: Id<"financialCompanies"> | undefined,
  productId: Id<"financialProducts"> | undefined,
): boolean {
  const keywords = normalizeKeywords(seed.keywords);
  return (
    card.title === seed.title &&
    card.content === seed.content &&
    card.category === seed.category &&
    card.network === seed.network &&
    card.companyId === companyId &&
    card.productId === productId &&
    sameStringArray(card.keywords, keywords) &&
    card.priority === seed.priority &&
    card.alwaysInclude === (seed.alwaysInclude ?? false) &&
    card.isAlert === (seed.isAlert ?? false) &&
    (card.alertLabel ?? undefined) === (seed.alertLabel ?? undefined) &&
    (card.visibility ?? "internal_only") === seed.visibility &&
    (card.sourceReference ?? undefined) === seed.sourceReference &&
    (card.showInFaq ?? false) === (seed.showInFaq ?? false) &&
    (card.faqQuestion ?? undefined) === (seed.faqQuestion ?? undefined) &&
    (card.faqCategory ?? undefined) === (seed.faqCategory ?? undefined) &&
    (card.faqOrder ?? undefined) === (seed.faqOrder ?? undefined) &&
    card.isActive === true
  );
}

function findActiveCardForSeed(
  cards: Doc<"knowledgeCards">[],
  seed: OfficialKnowledgeCardSeed,
): Doc<"knowledgeCards"> | null {
  const titles = new Set([seed.title, ...(seed.legacyTitles ?? [])]);
  const candidates = cards.filter(
    (card) => card.isActive && titles.has(card.title),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.version - a.version || b.updatedAt - a.updatedAt);
  const exact = candidates.find((card) => card.title === seed.title);
  return exact ?? candidates[0] ?? null;
}

/**
 * Seed idempotente KB ufficiale PCG 2026.
 * Versiona se il contenuto differisce; disattiva DEMO TECNICA senza cancellarle.
 */
export async function upsertPcgKnowledgeCards2026(
  ctx: MutationCtx,
  actorUserId: Id<"appUsers">,
): Promise<KnowledgeSeedSummary> {
  const now = Date.now();
  const result: KnowledgeSeedSummary = {
    created: [],
    skipped: [],
    versioned: [],
    deactivatedDemo: [],
    warnings: [],
  };

  const companies = await ctx.db.query("financialCompanies").collect();
  const companyByShort = new Map(
    companies.map((company) => [company.shortName, company._id]),
  );

  const products = await ctx.db.query("financialProducts").collect();
  const productByName = new Map(
    products
      .filter((product) => product.isActive)
      .map((product) => [product.name, product]),
  );

  let cards = await ctx.db.query("knowledgeCards").collect();

  for (const card of cards) {
    if (card.isActive && isDemoKnowledgeCard(card)) {
      await ctx.db.patch(card._id, { isActive: false, updatedAt: now });
      result.deactivatedDemo.push(card.title);
    }
  }

  cards = await ctx.db.query("knowledgeCards").collect();

  for (const seed of PCG_KNOWLEDGE_CARDS_2026) {
    const companyId = seed.companyShortName
      ? companyByShort.get(seed.companyShortName)
      : undefined;

    if (seed.companyShortName && !companyId) {
      result.warnings.push(
        `Finanziaria “${seed.companyShortName}” non trovata per “${seed.title}”: scheda creata senza companyId.`,
      );
    }

    let productId: Id<"financialProducts"> | undefined;
    if (seed.productName) {
      const product = productByName.get(seed.productName);
      if (!product) {
        result.warnings.push(
          `Prodotto “${seed.productName}” non trovato per “${seed.title}”: scheda creata senza productId.`,
        );
      } else if (companyId && product.companyId !== companyId) {
        result.warnings.push(
          `Prodotto “${seed.productName}” non appartiene a ${seed.companyShortName}: productId omesso.`,
        );
      } else {
        productId = product._id;
      }
    }

    const existing = findActiveCardForSeed(cards, seed);
    const keywords = normalizeKeywords(seed.keywords);

    if (existing && cardMatchesSeedPayload(existing, seed, companyId, productId)) {
      result.skipped.push(seed.title);
      continue;
    }

    if (existing) {
      await ctx.db.patch(existing._id, { isActive: false, updatedAt: now });
      await ctx.db.insert("knowledgeCards", {
        title: seed.title,
        content: seed.content,
        category: seed.category,
        network: seed.network,
        companyId,
        productId,
        keywords,
        priority: seed.priority,
        alwaysInclude: seed.alwaysInclude ?? false,
        isAlert: seed.isAlert ?? false,
        alertLabel: seed.alertLabel,
        visibility: seed.visibility,
        sourceReference: seed.sourceReference,
        adminNotes: `seedKey=${seed.seedKey}`,
        showInFaq: seed.showInFaq ?? false,
        faqQuestion: seed.faqQuestion,
        faqCategory: seed.faqCategory,
        faqOrder: seed.faqOrder,
        isActive: true,
        version: existing.version + 1,
        supersedesCardId: existing._id,
        createdByUserId: actorUserId,
        createdAt: now,
        updatedAt: now,
      });
      result.versioned.push(seed.title);
    } else {
      await ctx.db.insert("knowledgeCards", {
        title: seed.title,
        content: seed.content,
        category: seed.category,
        network: seed.network,
        companyId,
        productId,
        keywords,
        priority: seed.priority,
        alwaysInclude: seed.alwaysInclude ?? false,
        isAlert: seed.isAlert ?? false,
        alertLabel: seed.alertLabel,
        visibility: seed.visibility,
        sourceReference: seed.sourceReference,
        adminNotes: `seedKey=${seed.seedKey}`,
        showInFaq: seed.showInFaq ?? false,
        faqQuestion: seed.faqQuestion,
        faqCategory: seed.faqCategory,
        faqOrder: seed.faqOrder,
        isActive: true,
        version: 1,
        createdByUserId: actorUserId,
        createdAt: now,
        updatedAt: now,
      });
      result.created.push(seed.title);
    }

    // Disattiva eventuali alias legacy ancora attivi dopo il rename.
    cards = await ctx.db.query("knowledgeCards").collect();
    for (const legacyTitle of seed.legacyTitles ?? []) {
      for (const card of cards) {
        if (
          card.isActive &&
          card.title === legacyTitle &&
          card.title !== seed.title
        ) {
          await ctx.db.patch(card._id, { isActive: false, updatedAt: now });
        }
      }
    }
  }

  return result;
}

export { PCG_KNOWLEDGE_CARDS_2026, PCG_KB_SOURCE_REFERENCE };
