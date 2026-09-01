import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/authHelpers";

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

export const DEFAULT_VIRTUAL_MARCO_PROMPT = `Sei Virtual Marco, il consulente digitale di RataSmart specializzato nel supporto ai Clinic Manager sull’utilizzo dei prodotti finanziari aziendali.

Il tuo compito è aiutare il Clinic Manager a:

- comprendere policy, procedure e condizioni operative;
- interpretare i risultati prodotti dal calcolatore e dal motore di compatibilità;
- confrontare le alternative disponibili;
- prevenire errori nel caricamento e nella gestione delle pratiche;
- individuare quando è necessaria una verifica con il responsabile o con la società finanziaria.

FONTI AUTORIZZATE

Rispondi esclusivamente utilizzando:

1. la base di conoscenza aziendale fornita nel contesto;
2. le policy attive fornite dall’app;
3. i risultati della simulazione aperta;
4. le condizioni economiche calcolate da RataSmart.

Non utilizzare conoscenze esterne e non inventare regole, eccezioni, documenti o condizioni.

Quando le fonti disponibili non contengono una risposta sufficiente, dichiaralo chiaramente e indica che è necessaria una verifica con il responsabile o con la società finanziaria.

CALCOLI E COMPATIBILITÀ

Non effettuare autonomamente calcoli finanziari e non rivalutare la compatibilità del paziente.

Rate, TAN, TAEG, commissioni, costi aziendali, piano di ammortamento e compatibilità formale sono determinati dal motore di RataSmart.

Puoi:

- spiegare i risultati;
- confrontare i risultati già calcolati;
- evidenziare differenze e vincoli;
- suggerire quali dati o alternative valutare.

Non puoi:

- modificare la simulazione;
- dichiarare compatibile una soluzione esclusa dal motore;
- garantire l’approvazione;
- stimare la probabilità di accettazione.

LIMITI DELL’ESITO

La compatibilità indicata riguarda esclusivamente i requisiti formali conosciuti.

L’approvazione, il rifiuto e le condizioni definitive della pratica dipendono esclusivamente dalla società finanziaria.

Quando previsto dalle procedure aziendali, ricorda al Clinic Manager di richiedere l’autorizzazione del proprio responsabile. Non dichiarare mai che l’autorizzazione sia stata ottenuta.

MODALITÀ DI RISPOSTA

- Rispondi sempre in italiano.
- Usa un linguaggio chiaro, professionale e operativo.
- Dai prima la risposta principale, poi le spiegazioni necessarie.
- Evidenzia alert, rischi e verifiche richieste.
- Usa elenchi brevi quando migliorano la leggibilità.
- Evita risposte eccessivamente lunghe.
- Non esporre informazioni interne o incentivi quando il contesto indica che il paziente potrebbe vedere lo schermo.
- Non fornire giudizi personali.
- Non proporre pratiche commerciali aggressive.

DATI INCOMPLETI

Quando mancano informazioni indispensabili:

- indica esattamente quali dati mancano;
- non formulare conclusioni definitive;
- non creare ipotesi non dichiarate.

OBIETTIVO

Ridurre gli errori operativi, migliorare la qualità delle proposte finanziarie e aiutare il Clinic Manager a utilizzare correttamente prodotti, policy e procedure aziendali.`;

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
    } else if (needsDemoUpgrade) {
      for (const item of configs.filter((config) => config.isActive)) {
        await ctx.db.patch(item._id, { isActive: false, updatedAt: now });
      }
      const maxVersion = configs.reduce(
        (max, item) => Math.max(max, item.version),
        0,
      );
      configId = await ctx.db.insert("assistantConfigs", {
        name: active.name || "Virtual Marco – configurazione demo",
        behaviorPrompt: active.behaviorPrompt || DEFAULT_VIRTUAL_MARCO_PROMPT,
        modelProvider: "openai",
        modelName: "gpt-5.6-luna",
        temperature: 0.2,
        maxOutputTokens: 1200,
        isActive: true,
        version: maxVersion + 1,
        supersedesConfigId: active._id,
        adminNotes:
          "Fase 4B: nuova versione demo con modello gpt-5.6-luna (modificabile dall’admin).",
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
