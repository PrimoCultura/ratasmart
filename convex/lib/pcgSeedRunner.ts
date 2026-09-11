import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { validateFinancialTableEconomics } from "./financialValidation";
import {
  buildTableEconomicsFromPcgSeed,
  tableEconomicsMatchPcgSeed,
  type PcgTableSeed,
} from "./pcg2026SeedData";

export type SeedSummary = {
  created: string[];
  updatedOrVersioned: string[];
  skipped: string[];
  deactivated: string[];
  warnings: string[];
};

export async function upsertPcgCompanyAndTables(
  ctx: MutationCtx,
  args: {
    actorUserId: Id<"appUsers">;
    companyName: string;
    companyShortName: string;
    companyDescription: string;
    tables: PcgTableSeed[];
  },
): Promise<SeedSummary> {
  const now = Date.now();
  const summary: SeedSummary = {
    created: [],
    updatedOrVersioned: [],
    skipped: [],
    deactivated: [],
    warnings: [],
  };

  const companies = await ctx.db.query("financialCompanies").collect();
  let company =
    companies.find((item) => item.shortName === args.companyShortName) ??
    companies.find((item) => item.name === args.companyName) ??
    null;

  if (!company) {
    const companyId = await ctx.db.insert("financialCompanies", {
      name: args.companyName,
      shortName: args.companyShortName,
      description: args.companyDescription,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    company = await ctx.db.get(companyId);
    summary.created.push(`company:${args.companyShortName}`);
  } else if (!company.isActive) {
    await ctx.db.patch(company._id, { isActive: true, updatedAt: now });
    summary.updatedOrVersioned.push(
      `company:${args.companyShortName}(reactivated)`,
    );
  } else {
    summary.skipped.push(`company:${args.companyShortName}`);
  }

  if (!company) {
    throw new Error(`Impossibile creare la società ${args.companyName}.`);
  }

  const products = await ctx.db
    .query("financialProducts")
    .withIndex("by_company", (q) => q.eq("companyId", company!._id))
    .collect();
  const productByCode = new Map<string, Doc<"financialProducts">>();
  for (const product of products) {
    if (product.code) {
      productByCode.set(product.code, product);
    }
  }

  const uniqueProducts = new Map<
    string,
    { code: string; name: string; category: PcgTableSeed["category"]; description: string }
  >();
  for (const table of args.tables) {
    if (!uniqueProducts.has(table.productCode)) {
      uniqueProducts.set(table.productCode, {
        code: table.productCode,
        name: table.productName,
        category: table.category,
        description: table.description,
      });
    }
  }

  for (const seedProduct of uniqueProducts.values()) {
    const existing = productByCode.get(seedProduct.code);
    if (!existing) {
      const productId = await ctx.db.insert("financialProducts", {
        companyId: company._id,
        name: seedProduct.name,
        code: seedProduct.code,
        category: seedProduct.category,
        description: seedProduct.description,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const created = await ctx.db.get(productId);
      if (created) productByCode.set(seedProduct.code, created);
      summary.created.push(`product:${seedProduct.code}`);
      continue;
    }

    const needsPatch =
      existing.name !== seedProduct.name ||
      existing.category !== seedProduct.category ||
      (existing.description ?? undefined) !== seedProduct.description ||
      !existing.isActive;

    if (needsPatch) {
      await ctx.db.patch(existing._id, {
        name: seedProduct.name,
        category: seedProduct.category,
        description: seedProduct.description,
        isActive: true,
        updatedAt: now,
      });
      const refreshed = await ctx.db.get(existing._id);
      if (refreshed) productByCode.set(seedProduct.code, refreshed);
      summary.updatedOrVersioned.push(`product:${seedProduct.code}`);
    } else {
      summary.skipped.push(`product:${seedProduct.code}`);
    }
  }

  for (const seedTable of args.tables) {
    const product = productByCode.get(seedTable.productCode);
    if (!product) {
      summary.warnings.push(
        `Prodotto mancante per tabella ${seedTable.tableCode}`,
      );
      continue;
    }

    const economics = buildTableEconomicsFromPcgSeed(seedTable);
    validateFinancialTableEconomics(economics);

    const existingTables = await ctx.db
      .query("financialTables")
      .withIndex("by_table_code", (q) => q.eq("tableCode", seedTable.tableCode))
      .collect();

    const activeSameNetwork = existingTables
      .filter((item) => item.network === "PCG" && item.isActive)
      .sort((a, b) => b.version - a.version);

    const latestAny = existingTables
      .filter((item) => item.network === "PCG")
      .sort((a, b) => b.version - a.version)[0];

    const matchingActive = activeSameNetwork.find((item) =>
      tableEconomicsMatchPcgSeed(item, seedTable),
    );

    if (matchingActive) {
      summary.skipped.push(`table:${seedTable.tableCode}`);
      continue;
    }

    const row = {
      companyId: company._id,
      productId: product._id,
      network: "PCG" as const,
      tableCode: seedTable.tableCode,
      displayName: seedTable.displayName,
      description: seedTable.description,
      category: seedTable.category,
      ...economics,
      isActive: true,
      adminNotes: seedTable.adminNotes,
      createdByUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    };

    if (activeSameNetwork.length > 0) {
      const source = activeSameNetwork[0]!;
      summary.warnings.push(
        `Tabella ${seedTable.tableCode} attiva con condizioni diverse: creo nuova versione.`,
      );
      for (const active of activeSameNetwork) {
        await ctx.db.patch(active._id, { isActive: false, updatedAt: now });
      }
      await ctx.db.insert("financialTables", {
        ...row,
        version: source.version + 1,
        supersedesTableId: source._id,
      });
      summary.updatedOrVersioned.push(`table:${seedTable.tableCode}`);
      continue;
    }

    await ctx.db.insert("financialTables", {
      ...row,
      version: latestAny ? latestAny.version + 1 : 1,
      supersedesTableId: latestAny?._id,
    });
    summary.created.push(`table:${seedTable.tableCode}`);
  }

  return summary;
}
