import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/authHelpers";
import {
  AGOS_PCG_CODES_TO_DEACTIVATE,
  AGOS_PCG_PRODUCTS,
  AGOS_PCG_TABLES,
  buildTableEconomicsFromSeed,
  tableEconomicsMatchSeed,
} from "./lib/agosPcg2026Data";
import {
  COMPASS_PCG_TABLES,
  DEUTSCHE_BANK_PCG_TABLES,
} from "./lib/pcg2026SeedData";
import { upsertPcgCompanyAndTables } from "./lib/pcgSeedRunner";
import {
  upsertPcgFinancingPolicies2026,
  upsertPcgKnowledgeCards2026,
} from "./lib/pcgPolicySeedRunner";
import {
  upsertDesPaoleschi2026,
} from "./lib/desPaoleschiSeedRunner";
import { validateFinancialTableEconomics } from "./lib/financialValidation";

/**
 * Seed controllato per il profilo admin demo.
 * Idempotente: se esiste già un admin demo attivo, lo riusa.
 */
export const seedDemoAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const admins = await ctx.db
      .query("appUsers")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();

    const existing = admins.find((user) => user.isDemo && user.isActive);
    if (existing) {
      return {
        userId: existing._id,
        created: false,
      };
    }

    const now = Date.now();
    const userId = await ctx.db.insert("appUsers", {
      firstName: "Admin",
      lastName: "Demo",
      displayName: "Admin Demo",
      role: "admin",
      isDemo: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return {
      userId,
      created: true,
    };
  },
});

/**
 * Seed Fase 2 idempotente: Agos + prodotto Agos Pass + tabella demo PCG.
 * Importi min/max sono valori DEMO chiaramente etichettati, non ufficiali.
 */
export const seedAgosPassDemo = mutation({
  args: {
    actorUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth,
    // non ricevuta liberamente dal client.
    await requireAdmin(ctx, args.actorUserId);

    const now = Date.now();
    const companies = await ctx.db.query("financialCompanies").collect();
    let company: Doc<"financialCompanies"> | null =
      companies.find((item) => item.shortName === "Agos") ?? null;

    let companyCreated = false;
    if (!company) {
      const companyId = await ctx.db.insert("financialCompanies", {
        name: "Agos",
        shortName: "Agos",
        description: "Società finanziaria demo per sviluppo.",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      company = await ctx.db.get(companyId);
      companyCreated = true;
    }

    if (!company) {
      throw new Error("Impossibile creare la società Agos.");
    }

    const products = await ctx.db
      .query("financialProducts")
      .withIndex("by_company", (q) => q.eq("companyId", company._id))
      .collect();

    let product: Doc<"financialProducts"> | null =
      products.find((item) => item.code === "AGOS_PASS") ?? null;
    let productCreated = false;
    if (!product) {
      const productId = await ctx.db.insert("financialProducts", {
        companyId: company._id,
        name: "Agos Pass",
        code: "AGOS_PASS",
        category: "special",
        description: "Prodotto speciale dimostrativo (valori demo).",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      product = await ctx.db.get(productId);
      productCreated = true;
    }

    if (!product) {
      throw new Error("Impossibile creare il prodotto Agos Pass.");
    }

    const tables = await ctx.db
      .query("financialTables")
      .withIndex("by_table_code", (q) => q.eq("tableCode", "AGOS_PASS_DEMO"))
      .collect();

    let table: Doc<"financialTables"> | null =
      tables.find((item) => item.network === "PCG" && item.isActive) ?? null;
    let tableCreated = false;
    if (!table) {
      const tableId = await ctx.db.insert("financialTables", {
        companyId: company._id,
        productId: product._id,
        network: "PCG",
        tableCode: "AGOS_PASS_DEMO",
        displayName: "Agos Pass",
        description: "Tabella demo Agos Pass — condizioni illustrative.",
        category: "special",
        // DEMO: importi da completare/sostituire con valori ufficiali
        minimumAmount: 500,
        maximumAmount: 5000,
        minimumDurationMonths: 3,
        maximumDurationMonths: 12,
        durationStepMonths: 1,
        customerTanPercent: 10.5,
        openingFeeType: "none",
        openingFeeValue: 0,
        collectionFeePerInstallment: 0,
        firstInstallmentDelayDays: [30],
        requiresManagerAuthorizationNotice: false,
        isActive: true,
        adminNotes:
          "VALORI DEMO — importi min/max da completare manualmente con dati ufficiali. Non usare in produzione.",
        version: 1,
        createdByUserId: args.actorUserId,
        createdAt: now,
        updatedAt: now,
      });
      table = await ctx.db.get(tableId);
      tableCreated = true;
    }

    return {
      companyId: company._id,
      productId: product._id,
      tableId: table?._id,
      companyCreated,
      productCreated,
      tableCreated,
    };
  },
});

export const DEFAULT_VIRTUAL_MARCO_PROMPT = `Sei “Virtual Marco”, l’assistente virtuale di RataSmart specializzato nel supporto ai Clinic Manager nella gestione dei finanziamenti per il settore odontoiatrico.

Il tuo compito è aiutare il Clinic Manager a:

- effettuare un pre-screening preliminare del paziente;
- comprendere quali finanziarie o prodotti possono essere valutati;
- comprendere le soluzioni prodotte dal simulatore;
- spiegare perché una soluzione risulta compatibile, non compatibile o da verificare;
- comprendere procedure, documenti, vincoli ed eccezioni operative;
- prevenire errori nella gestione delle pratiche.

FONTI

Rispondi esclusivamente utilizzando le informazioni aziendali fornite da RataSmart:

- tabelle finanziarie strutturate;
- policy aziendali;
- risultati delle simulazioni;
- risultati del motore di compatibilità;
- knowledge base operativa;
- alert aziendali.

Non usare informazioni esterne.
Non inventare regole.
Non fare supposizioni quando una regola non è presente.

PRE-SCREENING

Puoi utilizzare i dati strutturati forniti da RataSmart per rispondere a domande preliminari su:

- età;
- importi;
- durate;
- situazione lavorativa;
- permesso di soggiorno;
- pensione;
- garante;
- prodotti;
- finanziarie;
- documenti;
- procedure.

Il pre-screening serve a evitare caricamenti inutili.

Se le informazioni disponibili consentono di escludere chiaramente una soluzione, spiegalo.

Se alcune soluzioni restano possibili, indicale.

Se mancano informazioni necessarie per una conclusione completa, indica esattamente quali dati mancano.

Utilizza prima tutte le informazioni già disponibili e soltanto dopo segnala i dati mancanti.

CALCOLI

Non eseguire autonomamente calcoli finanziari.

Non ricalcolare:

- rata;
- TAN;
- TAEG;
- commissioni;
- costo aziendale;
- netto liquidato;
- piano di ammortamento.

Per questi valori utilizza esclusivamente i risultati prodotti dal motore deterministico di RataSmart.

Se non esiste ancora una simulazione e il CM chiede un calcolo economico, indirizzalo al simulatore.

COMPATIBILITÀ

Non rivalutare arbitrariamente la compatibilità prodotta da RataSmart.

Una soluzione indicata come non compatibile non può essere dichiarata compatibile.

Una soluzione indicata come da verificare deve essere presentata come tale.

Durante il pre-screening puoi applicare e spiegare le policy strutturate fornite da RataSmart.

APPROVAZIONE

Non garantire mai l'approvazione della pratica.

La compatibilità formale e il pre-screening non equivalgono all'approvazione.

L'esito definitivo dipende dalla società finanziaria.

COSTI AZIENDALI

Quando una soluzione comporta un costo per l'azienda o richiede autorizzazione, evidenzialo chiaramente.

Non dichiarare mai che l'autorizzazione sia stata ottenuta.

GARANTI ED ECCEZIONI

Suggerisci o richiedi il garante soltanto quando questa indicazione deriva dalle policy o dalla knowledge base aziendale.

La presenza di un garante non garantisce l'approvazione.

STILE

Usa un linguaggio:

- chiaro;
- professionale;
- pratico;
- sintetico.

Dai prima la risposta utile al CM e successivamente le eventuali spiegazioni.

Evidenzia alert, rischi operativi, vincoli e verifiche necessarie.

Evita risposte inutilmente lunghe.

PRIVACY

Non chiedere dati identificativi non necessari come:

- nome e cognome;
- codice fiscale;
- IBAN;
- numero documento.

Non richiedere dati sanitari non necessari.

PATIENT SAFE

Quando la conversazione è in modalità patient_safe non mostrare:

- costi aziendali;
- netto liquidato;
- priorità commerciali interne;
- provvigioni;
- incentivi;
- messaggi riservati;
- motivazioni interne aziendali.

OBIETTIVO

Ridurre gli errori operativi dei Clinic Manager, evitare caricamenti inutili, migliorare la qualità delle richieste di finanziamento e rendere semplice l'utilizzo corretto di prodotti, policy e procedure aziendali.`;

/**
 * Seed Fase 4A idempotente: configurazione Virtual Marco + schede demo.
 * Contenuti DEMO TECNICA – NON USARE COME POLICY UFFICIALE.
 */
export const seedVirtualMarcoDemo = mutation({
  args: {
    actorUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    // TODO Auth0: in produzione l'identità dovrà essere ottenuta da ctx.auth.
    await requireAdmin(ctx, args.actorUserId);

    const now = Date.now();
    const configs = await ctx.db.query("assistantConfigs").collect();
    const active = configs.find((item) => item.isActive);
    let configCreated = false;
    let configUpgraded = false;
    let configId = active?._id;

    const needsDemoUpgrade =
      !active ||
      active.modelName === "da-configurare" ||
      active.modelName === "gpt-5-mini" ||
      active.modelProvider === "openai-compatible";

    const needsPreScreeningPromptUpgrade =
      !!active &&
      !needsDemoUpgrade &&
      !active.behaviorPrompt.includes("PRE-SCREENING");

    if (!active) {
      configId = await ctx.db.insert("assistantConfigs", {
        name: "Virtual Marco – configurazione demo",
        behaviorPrompt: DEFAULT_VIRTUAL_MARCO_PROMPT,
        modelProvider: "openai",
        modelName: "gpt-5.6-luna",
        temperature: 0.2,
        maxOutputTokens: 1200,
        isActive: true,
        version: 1,
        adminNotes:
          "Contenuto dimostrativo da sostituire con la base aziendale validata.",
        createdByUserId: args.actorUserId,
        createdAt: now,
        updatedAt: now,
      });
      configCreated = true;
    } else if (needsDemoUpgrade || needsPreScreeningPromptUpgrade) {
      for (const item of configs.filter((config) => config.isActive)) {
        await ctx.db.patch(item._id, { isActive: false, updatedAt: now });
      }
      const maxVersion = configs.reduce(
        (max, item) => Math.max(max, item.version),
        0,
      );
      configId = await ctx.db.insert("assistantConfigs", {
        name: active.name || "Virtual Marco – configurazione demo",
        behaviorPrompt: needsPreScreeningPromptUpgrade
          ? DEFAULT_VIRTUAL_MARCO_PROMPT
          : active.behaviorPrompt || DEFAULT_VIRTUAL_MARCO_PROMPT,
        modelProvider: needsDemoUpgrade ? "openai" : active.modelProvider,
        modelName: needsDemoUpgrade ? "gpt-5.6-luna" : active.modelName,
        temperature: active.temperature ?? 0.2,
        maxOutputTokens: active.maxOutputTokens ?? 1200,
        isActive: true,
        version: maxVersion + 1,
        supersedesConfigId: active._id,
        adminNotes: needsPreScreeningPromptUpgrade
          ? "Upgrade prompt: supporto PRE-SCREENING (modificabile dall’admin)."
          : "Fase 4B: nuova versione demo con modello gpt-5.6-luna (modificabile dall’admin).",
        createdByUserId: args.actorUserId,
        createdAt: now,
        updatedAt: now,
      });
      configUpgraded = true;
    }

    const companies = await ctx.db.query("financialCompanies").collect();
    const agos = companies.find((item) => item.shortName === "Agos");
    const agosCompanyId = agos?._id;

    const cards = await ctx.db.query("knowledgeCards").collect();
    const demoTitles = new Set(
      cards.map((item) => item.title).filter((title) => title.includes("DEMO TECNICA")),
    );

    const demoCards: Array<{
      title: string;
      content: string;
      category:
        | "liquidation"
        | "guarantor"
        | "operational_alert"
        | "payment_methods";
      network: "PCG" | "DES" | "BOTH";
      companyId?: Id<"financialCompanies">;
      keywords: string[];
      priority: number;
      alwaysInclude: boolean;
      isAlert: boolean;
      alertLabel?: string;
      visibility: "patient_safe" | "internal_only";
    }> = [
      {
        title: "DEMO TECNICA – Gestione liquidazione",
        content:
          "DEMO TECNICA – NON USARE COME POLICY UFFICIALE. Procedura dimostrativa di liquidazione: verificare documenti, confermare IBAN e attendere esito finanziaria prima di comunicare tempi al paziente.",
        category: "liquidation",
        network: "BOTH",
        keywords: ["liquidazione", "iban", "accredito"],
        priority: 70,
        alwaysInclude: false,
        isAlert: false,
        visibility: "internal_only",
      },
      {
        title: "DEMO TECNICA – Regola garante",
        content:
          "DEMO TECNICA – NON USARE COME POLICY UFFICIALE. Quando richiesto, il garante deve risultare formalmente ammissibile secondo le policy della finanziaria. Non inventare eccezioni.",
        category: "guarantor",
        network: "BOTH",
        keywords: ["garante", "fideiussione"],
        priority: 65,
        alwaysInclude: false,
        isAlert: false,
        visibility: "patient_safe",
      },
      {
        title: "DEMO TECNICA – Alert data rata Agos",
        content:
          "DEMO TECNICA – NON USARE COME POLICY UFFICIALE. ATTENZIONE: CON AGOS NON MODIFICARE LA DATA DI SCADENZA RATA CHE PROPONE IL SISTEMA DI CARICAMENTO.",
        category: "operational_alert",
        network: "PCG",
        companyId: agosCompanyId,
        keywords: ["agos", "data", "scadenza", "rata", "addebito"],
        priority: 90,
        alwaysInclude: false,
        isAlert: true,
        alertLabel: "Non modificare data scadenza rata Agos",
        visibility: "patient_safe",
      },
      {
        title: "DEMO TECNICA – Metodi di pagamento",
        content:
          "DEMO TECNICA – NON USARE COME POLICY UFFICIALE. Esempio: verificare i metodi di pagamento ammessi dalla finanziaria (RID/SDD, carte). Le carte ricaricabili possono essere soggette a limiti.",
        category: "payment_methods",
        network: "BOTH",
        keywords: ["pagamento", "carta", "postepay", "ricaricabile", "rid"],
        priority: 55,
        alwaysInclude: false,
        isAlert: false,
        visibility: "patient_safe",
      },
    ];

    let cardsCreated = 0;
    for (const demo of demoCards) {
      if (demoTitles.has(demo.title)) {
        continue;
      }
      await ctx.db.insert("knowledgeCards", {
        title: demo.title,
        content: demo.content,
        category: demo.category,
        network: demo.network,
        companyId: demo.companyId,
        keywords: demo.keywords,
        priority: demo.priority,
        alwaysInclude: demo.alwaysInclude,
        isAlert: demo.isAlert,
        alertLabel: demo.alertLabel,
        visibility: demo.visibility,
        adminNotes:
          "Contenuto dimostrativo da sostituire con la base aziendale validata.",
        sourceReference: "Seed Fase 4A/4B",
        isActive: true,
        version: 1,
        createdByUserId: args.actorUserId,
        createdAt: now,
        updatedAt: now,
      });
      cardsCreated += 1;
    }

    return {
      configId,
      configCreated,
      configUpgraded,
      cardsCreated,
    };
  },
});

/**
 * Seed idempotente Agos PCG 2026 con durationTerms reali.
 * Non elimina versioni storiche; disattiva NBJ/NBM/AGOS_PASS_DEMO se attive.
 */
export const seedAgosPcg2026 = mutation({
  args: {
    actorUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);

    const now = Date.now();
    const summary = {
      created: [] as string[],
      updatedOrVersioned: [] as string[],
      skipped: [] as string[],
      deactivated: [] as string[],
      warnings: [] as string[],
    };

    const companies = await ctx.db.query("financialCompanies").collect();
    let company =
      companies.find((item) => item.shortName === "Agos") ??
      companies.find((item) => item.name === "Agos") ??
      null;

    if (!company) {
      const companyId = await ctx.db.insert("financialCompanies", {
        name: "Agos",
        shortName: "Agos",
        description: "Società finanziaria Agos – rete PCG.",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      company = await ctx.db.get(companyId);
      summary.created.push("company:Agos");
    } else if (!company.isActive) {
      await ctx.db.patch(company._id, { isActive: true, updatedAt: now });
      summary.updatedOrVersioned.push("company:Agos(reactivated)");
    } else {
      summary.skipped.push("company:Agos");
    }

    if (!company) {
      throw new Error("Impossibile creare la società Agos.");
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

    for (const seedProduct of AGOS_PCG_PRODUCTS) {
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
        if (created) {
          productByCode.set(seedProduct.code, created);
        }
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
        if (refreshed) {
          productByCode.set(seedProduct.code, refreshed);
        }
        summary.updatedOrVersioned.push(`product:${seedProduct.code}`);
      } else {
        summary.skipped.push(`product:${seedProduct.code}`);
      }
    }

    for (const code of AGOS_PCG_CODES_TO_DEACTIVATE) {
      const tables = await ctx.db
        .query("financialTables")
        .withIndex("by_table_code", (q) => q.eq("tableCode", code))
        .collect();
      for (const table of tables) {
        if (table.isActive) {
          await ctx.db.patch(table._id, { isActive: false, updatedAt: now });
          summary.deactivated.push(`${code}#v${table.version}`);
        }
      }
    }

    for (const seedTable of AGOS_PCG_TABLES) {
      const product = productByCode.get(seedTable.productCode);
      if (!product) {
        summary.warnings.push(
          `Prodotto mancante per tabella ${seedTable.tableCode}`,
        );
        continue;
      }

      const economics = buildTableEconomicsFromSeed(seedTable);
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
        tableEconomicsMatchSeed(item, seedTable),
      );

      if (matchingActive) {
        summary.skipped.push(`table:${seedTable.tableCode}`);
        continue;
      }

      if (activeSameNetwork.length > 0) {
        const source = activeSameNetwork[0]!;
        summary.warnings.push(
          `Tabella ${seedTable.tableCode} attiva con condizioni diverse: creo nuova versione.`,
        );
        for (const active of activeSameNetwork) {
          await ctx.db.patch(active._id, { isActive: false, updatedAt: now });
        }
        await ctx.db.insert("financialTables", {
          companyId: company._id,
          productId: product._id,
          network: "PCG",
          tableCode: seedTable.tableCode,
          displayName: seedTable.displayName,
          description: seedTable.description,
          category: seedTable.category,
          ...economics,
          isActive: true,
          adminNotes: seedTable.adminNotes,
          version: source.version + 1,
          supersedesTableId: source._id,
          createdByUserId: args.actorUserId,
          createdAt: now,
          updatedAt: now,
        });
        summary.updatedOrVersioned.push(`table:${seedTable.tableCode}`);
        continue;
      }

      const version = latestAny ? latestAny.version + 1 : 1;
      await ctx.db.insert("financialTables", {
        companyId: company._id,
        productId: product._id,
        network: "PCG",
        tableCode: seedTable.tableCode,
        displayName: seedTable.displayName,
        description: seedTable.description,
        category: seedTable.category,
        ...economics,
        isActive: true,
        adminNotes: seedTable.adminNotes,
        version,
        supersedesTableId: latestAny?._id,
        createdByUserId: args.actorUserId,
        createdAt: now,
        updatedAt: now,
      });
      summary.created.push(`table:${seedTable.tableCode}`);
    }

    return summary;
  },
});

export const seedDeutscheBankPcg2026 = mutation({
  args: {
    actorUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    return await upsertPcgCompanyAndTables(ctx, {
      actorUserId: args.actorUserId,
      companyName: "Deutsche Bank",
      companyShortName: "Deutsche Bank",
      companyDescription: "Società finanziaria Deutsche Bank – rete PCG.",
      tables: DEUTSCHE_BANK_PCG_TABLES,
    });
  },
});

export const seedCompassPcg2026 = mutation({
  args: {
    actorUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    return await upsertPcgCompanyAndTables(ctx, {
      actorUserId: args.actorUserId,
      companyName: "Compass",
      companyShortName: "Compass",
      companyDescription: "Società finanziaria Compass – rete PCG.",
      tables: COMPASS_PCG_TABLES,
    });
  },
});

/**
 * Seed idempotente policy formali PCG 2026 (Agos, Compass, Deutsche Bank).
 * Non modifica tabelle finanziarie. Versiona se le regole differiscono.
 * Non gestisce più la Knowledge Base ufficiale (usare seedPcgKnowledgeBase2026).
 */
export const seedPcgFinancingPolicies2026 = mutation({
  args: {
    actorUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const policies = await upsertPcgFinancingPolicies2026(ctx, args.actorUserId);
    return { policies };
  },
});

/**
 * Seed idempotente Knowledge Base ufficiale PCG 2026.
 * Versiona le schede esistenti se il contenuto differisce; disattiva DEMO TECNICA.
 */
export const seedPcgKnowledgeBase2026 = mutation({
  args: {
    actorUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    return await upsertPcgKnowledgeCards2026(ctx, args.actorUserId);
  },
});
/**
 * Attiva/aggiorna il prompt PRE-SCREENING se la config attiva non lo contiene.
 * Non sovrascrive una config custom che ha già PRE-SCREENING.
 */
export const activateVirtualMarcoPreScreeningPrompt = mutation({
  args: {
    actorUserId: v.id("appUsers"),
    forceReplaceCustomPrompt: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const now = Date.now();
    const configs = await ctx.db.query("assistantConfigs").collect();
    const active = configs.find((item) => item.isActive);

    if (!active) {
      const configId = await ctx.db.insert("assistantConfigs", {
        name: "Virtual Marco – configurazione PCG",
        behaviorPrompt: DEFAULT_VIRTUAL_MARCO_PROMPT,
        modelProvider: "openai",
        modelName: "gpt-5.6-luna",
        temperature: 0.2,
        maxOutputTokens: 1200,
        isActive: true,
        version: 1,
        adminNotes: "Prompt con PRE-SCREENING attivato.",
        createdByUserId: args.actorUserId,
        createdAt: now,
        updatedAt: now,
      });
      return {
        status: "created" as const,
        configId,
        warning: null as string | null,
      };
    }

    if (active.behaviorPrompt.includes("PRE-SCREENING")) {
      return {
        status: "already_active" as const,
        configId: active._id,
        warning: null as string | null,
      };
    }

    const looksCustom =
      !active.behaviorPrompt.includes("Virtual Marco") ||
      active.name.toLowerCase().includes("custom") ||
      (active.adminNotes ?? "").toLowerCase().includes("custom");

    if (looksCustom && !args.forceReplaceCustomPrompt) {
      return {
        status: "needs_manual_review" as const,
        configId: active._id,
        warning:
          "Configurazione attiva senza sezione PRE-SCREENING e potenzialmente personalizzata. Aggiorna il prompt da admin oppure riesegui con forceReplaceCustomPrompt.",
      };
    }

    for (const item of configs.filter((config) => config.isActive)) {
      await ctx.db.patch(item._id, { isActive: false, updatedAt: now });
    }
    const maxVersion = configs.reduce(
      (max, item) => Math.max(max, item.version),
      0,
    );
    const configId = await ctx.db.insert("assistantConfigs", {
      name: active.name || "Virtual Marco – configurazione PCG",
      behaviorPrompt: DEFAULT_VIRTUAL_MARCO_PROMPT,
      modelProvider: active.modelProvider,
      modelName: active.modelName,
      temperature: active.temperature,
      maxOutputTokens: active.maxOutputTokens,
      isActive: true,
      version: maxVersion + 1,
      supersedesConfigId: active._id,
      adminNotes:
        "Upgrade prompt PRE-SCREENING (policy/tabelle/KB; nessun calcolo autonomo).",
      createdByUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    });

    return {
      status: "upgraded" as const,
      configId,
      warning: null as string | null,
    };
  },
});

/**
 * Seed idempotente DES / Paoleschi 2026.
 * Non inventa economie tabelle mancanti; crea società/prodotto shell e
 * disattiva disponibilità errate se presenti.
 */
export const seedDesPaoleschi2026 = mutation({
  args: {
    actorUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    return await upsertDesPaoleschi2026(ctx, args.actorUserId);
  },
});
