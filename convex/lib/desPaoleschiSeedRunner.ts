import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { NetworkCode } from "../../shared/domain/networks.ts";
import {
  DES_COMPASS_CODES_TO_DEACTIVATE,
  DES_UNAVAILABLE_COMPANY_SHORT_NAMES,
  LEGACY_DES_DB_STANDARD_TAN_PERCENT,
  PAOLESCHI_UNAVAILABLE_COMPANY_SHORT_NAMES,
} from "../../shared/network-config/des-paoleschi-2026.ts";
import { validateFinancialTableEconomics } from "./financialValidation";
import {
  buildEconomicsFromSeed2026,
  DES_ALLOWED_TABLE_CODES,
  DES_PAOLESCHI_TABLE_SEEDS,
  PAOLESCHI_ALLOWED_TABLE_CODES,
  PCG_ADDON_TABLE_SEEDS,
  tableEconomicsMatchSeed2026,
  type FinancialTableSeed2026,
} from "./desPaoleschi2026Data";

export type DesPaoleschiSeedSummary = {
  created: string[];
  updated: string[];
  deactivated: string[];
  unchanged: string[];
  missingData: string[];
  warnings: string[];
};

async function ensureCompany(
  ctx: MutationCtx,
  summary: DesPaoleschiSeedSummary,
  now: number,
  input: {
    name: string;
    shortName: string;
    description: string;
  },
): Promise<Doc<"financialCompanies">> {
  const companies = await ctx.db.query("financialCompanies").collect();
  const existing =
    companies.find((item) => item.shortName === input.shortName) ??
    companies.find((item) => item.name === input.name) ??
    null;

  if (!existing) {
    const id = await ctx.db.insert("financialCompanies", {
      name: input.name,
      shortName: input.shortName,
      description: input.description,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const created = await ctx.db.get(id);
    if (!created) {
      throw new Error(`Impossibile creare la società ${input.shortName}.`);
    }
    summary.created.push(`company:${input.shortName}`);
    return created;
  }

  if (!existing.isActive) {
    await ctx.db.patch(existing._id, { isActive: true, updatedAt: now });
    summary.updated.push(`company:${input.shortName}(reactivated)`);
    const refreshed = await ctx.db.get(existing._id);
    return refreshed ?? existing;
  }

  summary.unchanged.push(`company:${input.shortName}`);
  return existing;
}

async function ensureProduct(
  ctx: MutationCtx,
  summary: DesPaoleschiSeedSummary,
  now: number,
  company: Doc<"financialCompanies">,
  seed: FinancialTableSeed2026,
): Promise<Doc<"financialProducts">> {
  const products = await ctx.db
    .query("financialProducts")
    .withIndex("by_company", (q) => q.eq("companyId", company._id))
    .collect();

  const existing =
    products.find((item) => item.code === seed.productCode) ??
    (seed.productCode === "TR7"
      ? products.find(
          (item) =>
            item.code === "HEYLIGHT_BNPL" ||
            item.name.toLowerCase().includes("heylight"),
        )
      : null) ??
    null;

  if (!existing) {
    const id = await ctx.db.insert("financialProducts", {
      companyId: company._id,
      name: seed.productName,
      code: seed.productCode,
      category: seed.category,
      description: seed.description,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const created = await ctx.db.get(id);
    if (!created) {
      throw new Error(`Impossibile creare prodotto ${seed.productCode}`);
    }
    summary.created.push(`product:${seed.productCode}`);
    return created;
  }

  const needsPatch =
    existing.name !== seed.productName ||
    existing.code !== seed.productCode ||
    existing.category !== seed.category ||
    (existing.description ?? undefined) !== seed.description ||
    !existing.isActive;

  if (needsPatch) {
    await ctx.db.patch(existing._id, {
      name: seed.productName,
      code: seed.productCode,
      category: seed.category,
      description: seed.description,
      isActive: true,
      updatedAt: now,
    });
    summary.updated.push(`product:${seed.productCode}`);
    const refreshed = await ctx.db.get(existing._id);
    return refreshed ?? existing;
  }

  summary.unchanged.push(`product:${seed.productCode}`);
  return existing;
}

async function upsertTableForNetwork(
  ctx: MutationCtx,
  summary: DesPaoleschiSeedSummary,
  now: number,
  actorUserId: Id<"appUsers">,
  company: Doc<"financialCompanies">,
  product: Doc<"financialProducts">,
  seed: FinancialTableSeed2026,
  network: NetworkCode,
): Promise<void> {
  const economics = buildEconomicsFromSeed2026(seed);
  validateFinancialTableEconomics({
    ...economics,
    internalCostPercentAt24Months: undefined,
  });

  const existingTables = await ctx.db
    .query("financialTables")
    .withIndex("by_table_code", (q) => q.eq("tableCode", seed.tableCode))
    .collect();

  const activeSameNetwork = existingTables
    .filter((item) => item.network === network && item.isActive)
    .sort((a, b) => b.version - a.version);

  const latestAny = existingTables
    .filter((item) => item.network === network)
    .sort((a, b) => b.version - a.version)[0];

  const matchingActive = activeSameNetwork.find((item) =>
    tableEconomicsMatchSeed2026(item, seed),
  );

  if (matchingActive) {
    summary.unchanged.push(`table:${network}:${seed.tableCode}`);
    return;
  }

  const row = {
    companyId: company._id,
    productId: product._id,
    network,
    tableCode: seed.tableCode,
    displayName: seed.displayName,
    description: seed.description,
    category: seed.category,
    ...economics,
    isActive: true,
    adminNotes: seed.adminNotes,
    createdByUserId: actorUserId,
    createdAt: now,
    updatedAt: now,
  };

  if (activeSameNetwork.length > 0) {
    const source = activeSameNetwork[0]!;
    for (const active of activeSameNetwork) {
      await ctx.db.patch(active._id, { isActive: false, updatedAt: now });
    }
    await ctx.db.insert("financialTables", {
      ...row,
      version: source.version + 1,
      supersedesTableId: source._id,
    });
    summary.updated.push(`table:${network}:${seed.tableCode}`);
    return;
  }

  await ctx.db.insert("financialTables", {
    ...row,
    version: latestAny ? latestAny.version + 1 : 1,
    supersedesTableId: latestAny?._id,
  });
  summary.created.push(`table:${network}:${seed.tableCode}`);
}

async function upsertSmvSeniorPolicy(
  ctx: MutationCtx,
  summary: DesPaoleschiSeedSummary,
  now: number,
  actorUserId: Id<"appUsers">,
  companyId: Id<"financialCompanies">,
  table: Doc<"financialTables">,
): Promise<void> {
  const sets = await ctx.db
    .query("policySets")
    .withIndex("by_financial_table", (q) =>
      q.eq("financialTableId", table._id),
    )
    .collect();

  const active = sets
    .filter((item) => item.isActive)
    .sort((a, b) => b.version - a.version)[0];

  const name = `Senior SMV age – ${table.network}`;
  const description =
    "Età alla richiesta: da 77 anni 6 mesi 1 giorno a 85 anni 11 mesi 29 giorni.";

  let policySetId = active?._id;
  if (!active) {
    policySetId = await ctx.db.insert("policySets", {
      companyId,
      financialTableId: table._id,
      network: table.network,
      name,
      description,
      sourceReference: "Condizioni Deutsche Bank Senior SMV 2026",
      isActive: true,
      version: 1,
      createdByUserId: actorUserId,
      createdAt: now,
      updatedAt: now,
    });
    summary.created.push(`policySet:${table.network}:SMV`);
  } else if (active.name !== name || (active.description ?? "") !== description) {
    await ctx.db.patch(active._id, {
      name,
      description,
      updatedAt: now,
    });
    summary.updated.push(`policySet:${table.network}:SMV`);
  } else {
    summary.unchanged.push(`policySet:${table.network}:SMV`);
  }

  if (!policySetId) return;

  const rules = await ctx.db
    .query("policyRules")
    .withIndex("by_policy_set", (q) => q.eq("policySetId", policySetId!))
    .collect();

  const existingRule = rules.find(
    (rule) =>
      rule.isActive && rule.ruleType === "precise_age_at_application_range",
  );

  const rulePayload = {
    policySetId,
    ruleType: "precise_age_at_application_range" as const,
    operator: "custom" as const,
    stringValues: ["77-6-1", "85-11-29"],
    failureMessage:
      "Il paziente non rientra nel range di età Senior SMV (77 anni 6 mesi 1 giorno – 85 anni 11 mesi 29 giorni) al momento della richiesta.",
    verificationMessage:
      "Per verificare l’età Senior SMV è necessaria la data di nascita (il solo anno compiuto non basta per i 77enni).",
    sortOrder: 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  if (!existingRule) {
    await ctx.db.insert("policyRules", rulePayload);
    summary.created.push(`policyRule:${table.network}:SMV-age`);
  } else {
    const same =
      JSON.stringify(existingRule.stringValues ?? []) ===
        JSON.stringify(rulePayload.stringValues) &&
      existingRule.failureMessage === rulePayload.failureMessage &&
      (existingRule.verificationMessage ?? undefined) ===
        rulePayload.verificationMessage;
    if (!same) {
      await ctx.db.patch(existingRule._id, {
        stringValues: rulePayload.stringValues,
        failureMessage: rulePayload.failureMessage,
        verificationMessage: rulePayload.verificationMessage,
        updatedAt: now,
      });
      summary.updated.push(`policyRule:${table.network}:SMV-age`);
    } else {
      summary.unchanged.push(`policyRule:${table.network}:SMV-age`);
    }
  }
}

function companyByShortName(
  companies: Doc<"financialCompanies">[],
  shortName: string,
): Doc<"financialCompanies"> | null {
  return companies.find((item) => item.shortName === shortName) ?? null;
}

async function seedTables(
  ctx: MutationCtx,
  summary: DesPaoleschiSeedSummary,
  now: number,
  actorUserId: Id<"appUsers">,
  seeds: FinancialTableSeed2026[],
  networksFilter: NetworkCode[],
): Promise<void> {
  let companies = await ctx.db.query("financialCompanies").collect();

  for (const seed of seeds) {
    const targetNetworks = seed.networks.filter((network) =>
      networksFilter.includes(network),
    );
    if (targetNetworks.length === 0) continue;

    let company = companyByShortName(companies, seed.companyShortName);
    if (!company) {
      company = await ensureCompany(ctx, summary, now, {
        name: seed.companyShortName,
        shortName: seed.companyShortName,
        description: `Società finanziaria ${seed.companyShortName}.`,
      });
      companies = await ctx.db.query("financialCompanies").collect();
    }

    const product = await ensureProduct(ctx, summary, now, company, seed);

    for (const network of targetNetworks) {
      await upsertTableForNetwork(
        ctx,
        summary,
        now,
        actorUserId,
        company,
        product,
        seed,
        network,
      );
    }
  }
}

async function deactivateInvalidAvailability(
  ctx: MutationCtx,
  summary: DesPaoleschiSeedSummary,
  now: number,
): Promise<void> {
  const companies = await ctx.db.query("financialCompanies").collect();
  const tables = await ctx.db.query("financialTables").collect();
  const shortById = new Map(
    companies.map((item) => [item._id, item.shortName] as const),
  );
  const desAllowed = new Set<string>(DES_ALLOWED_TABLE_CODES);
  const paoleschiAllowed = new Set<string>(PAOLESCHI_ALLOWED_TABLE_CODES);
  const compassLegacy = new Set<string>(DES_COMPASS_CODES_TO_DEACTIVATE);
  const unavailableDes = new Set<string>(DES_UNAVAILABLE_COMPANY_SHORT_NAMES);
  const unavailablePaoleschi = new Set<string>(
    PAOLESCHI_UNAVAILABLE_COMPANY_SHORT_NAMES,
  );

  for (const table of tables) {
    if (!table.isActive) continue;
    const short = shortById.get(table.companyId);
    if (!short) continue;

    let deactivate = false;
    let reason = "";

    if (table.network === "DES") {
      if (unavailableDes.has(short) || !desAllowed.has(table.tableCode)) {
        deactivate = true;
        reason = "DES-not-allowed";
      }
      if (short === "Compass" && compassLegacy.has(table.tableCode)) {
        deactivate = true;
        reason = "Compass-legacy";
      }
      if (
        short === "Deutsche Bank" &&
        table.category === "standard" &&
        table.customerTanPercent === LEGACY_DES_DB_STANDARD_TAN_PERCENT
      ) {
        deactivate = true;
        reason = "DB-legacy-8.95";
      }
    }

    if (table.network === "Paoleschi") {
      if (
        unavailablePaoleschi.has(short) ||
        !paoleschiAllowed.has(table.tableCode)
      ) {
        deactivate = true;
        reason = "Paoleschi-not-allowed";
      }
    }

    if (deactivate) {
      await ctx.db.patch(table._id, { isActive: false, updatedAt: now });
      summary.deactivated.push(
        `table:${table.network}:${table.tableCode}(${reason})`,
      );
    }
  }
}

async function seedSmvPolicies(
  ctx: MutationCtx,
  summary: DesPaoleschiSeedSummary,
  now: number,
  actorUserId: Id<"appUsers">,
): Promise<void> {
  const companies = await ctx.db.query("financialCompanies").collect();
  const db = companies.find((item) => item.shortName === "Deutsche Bank");
  if (!db) return;

  const tables = await ctx.db
    .query("financialTables")
    .withIndex("by_table_code", (q) => q.eq("tableCode", "SMV"))
    .collect();

  for (const table of tables.filter((item) => item.isActive)) {
    await upsertSmvSeniorPolicy(
      ctx,
      summary,
      now,
      actorUserId,
      db._id,
      table,
    );
  }
}

/**
 * Seed idempotente DES / Paoleschi 2026 + addon PCG (HeyLight TR7, SMV).
 */
export async function upsertDesPaoleschi2026(
  ctx: MutationCtx,
  actorUserId: Id<"appUsers">,
): Promise<DesPaoleschiSeedSummary> {
  const now = Date.now();
  const summary: DesPaoleschiSeedSummary = {
    created: [],
    updated: [],
    deactivated: [],
    unchanged: [],
    missingData: [
      "Policy paziente generali DES ancora da configurare",
      "Policy paziente generali Paoleschi ancora da configurare",
    ],
    warnings: [],
  };

  await ensureCompany(ctx, summary, now, {
    name: "Compass",
    shortName: "Compass",
    description: "Società finanziaria Compass.",
  });
  await ensureCompany(ctx, summary, now, {
    name: "Deutsche Bank",
    shortName: "Deutsche Bank",
    description: "Società finanziaria Deutsche Bank.",
  });
  await ensureCompany(ctx, summary, now, {
    name: "HeyLight",
    shortName: "HeyLight",
    description: "HeyLight / SmartPOS BNPL.",
  });

  await seedTables(ctx, summary, now, actorUserId, DES_PAOLESCHI_TABLE_SEEDS, [
    "DES",
    "Paoleschi",
  ]);
  await seedTables(ctx, summary, now, actorUserId, PCG_ADDON_TABLE_SEEDS, [
    "PCG",
  ]);

  await deactivateInvalidAvailability(ctx, summary, now);
  await seedSmvPolicies(ctx, summary, now, actorUserId);

  summary.warnings.push(
    "Policy paziente generali DES/Paoleschi non inventate: attiva solo la policy età Senior SMV per tabella.",
  );

  return summary;
}
