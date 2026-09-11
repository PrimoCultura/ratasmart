import { describe, expect, it } from "vitest";
import {
  assertPreScreeningPrivacy,
  buildEntityCatalogFromActiveData,
  buildPreScreeningContext,
  detectPreScreeningIntents,
  formatPreScreeningContext,
  matchEntitiesFromQuestion,
  shouldAttachPreScreening,
} from "../index.ts";
import type { PreScreeningSourceData } from "../pre-screening-context.ts";

describe("detectPreScreeningIntents", () => {
  it.each([
    ["Ho un paziente di 80 anni", ["age"]],
    ["Devo finanziare 25.000 euro", ["amount"]],
    ["Chi arriva a 84 rate?", ["duration"]],
    ["Ha un contratto a tempo determinato", ["employment"]],
    ["È extracomunitario", ["residence_permit"]],
    ["È pensionato", ["pensioner"]],
    ["Posso mettere il figlio come garante?", ["guarantor"]],
    ["Che documenti servono?", ["documents"]],
  ] as const)("%s → %j", (question, expected) => {
    const intents = detectPreScreeningIntents(question);
    for (const intent of expected) {
      expect(intents).toContain(intent);
    }
    expect(intents).not.toContain("generic");
  });

  it("studente 2000€ → employment + amount", () => {
    const intents = detectPreScreeningIntents(
      "devo finanziare uno studente per 2000€ come posso fare?",
    );
    expect(intents).toEqual(
      expect.arrayContaining(["employment", "amount"]),
    );
  });

  it("multi-intent: extracomunitario di 78 anni", () => {
    const intents = detectPreScreeningIntents(
      "Ho un extracomunitario di 78 anni",
    );
    expect(intents).toEqual(
      expect.arrayContaining(["age", "residence_permit"]),
    );
  });

  it("domanda non classificata → generic", () => {
    expect(detectPreScreeningIntents("Ciao, come stai?")).toEqual(["generic"]);
  });
});

function fixtureSource(overrides?: Partial<PreScreeningSourceData>): PreScreeningSourceData {
  return {
    network: "PCG",
    calculationDate: Date.UTC(2026, 5, 1),
    companies: [
      { id: "c-agos", name: "Agos", shortName: "Agos" },
      { id: "c-db", name: "Deutsche Bank", shortName: "Deutsche Bank" },
      { id: "c-compass", name: "Compass", shortName: "Compass" },
      { id: "c-inactive", name: "Inactive Co", shortName: "Inactive" },
    ],
    products: [
      {
        id: "p-agos",
        companyId: "c-agos",
        name: "Agos Standard",
        code: "AGOS_STD",
        category: "standard",
        isActive: true,
      },
      {
        id: "p-db",
        companyId: "c-db",
        name: "DB Standard",
        code: "DB_STD",
        category: "standard",
        isActive: true,
      },
      {
        id: "p-compass",
        companyId: "c-compass",
        name: "Compass Standard",
        code: "CMP_STD",
        category: "standard",
        isActive: true,
      },
    ],
    tables: [
      {
        id: "t-nbq",
        companyId: "c-agos",
        productId: "p-agos",
        tableCode: "NBQ",
        displayName: "NBQ",
        category: "standard",
        network: "PCG",
        minimumAmount: 2000,
        maximumAmount: 30000,
        minimumDurationMonths: 12,
        maximumDurationMonths: 84,
        durationStepMonths: 6,
        durationTerms: null,
        firstInstallmentDelayDays: [30],
        customerTanPercent: 10.5,
        isActive: true,
      },
      {
        id: "t-su",
        companyId: "c-db",
        productId: "p-db",
        tableCode: "S/U",
        displayName: "S/U",
        category: "standard",
        network: "PCG",
        minimumAmount: 2600,
        maximumAmount: 20000,
        minimumDurationMonths: 24,
        maximumDurationMonths: 72,
        durationStepMonths: 1,
        durationTerms: [
          { durationMonths: 24 },
          { durationMonths: 36 },
          { durationMonths: 48 },
          { durationMonths: 60 },
          { durationMonths: 72 },
        ],
        firstInstallmentDelayDays: [30],
        customerTanPercent: 10.5,
        isActive: true,
      },
      {
        id: "t-81k",
        companyId: "c-compass",
        productId: "p-compass",
        tableCode: "81K",
        displayName: "81K",
        category: "standard",
        network: "PCG",
        minimumAmount: 1000,
        maximumAmount: 30000,
        minimumDurationMonths: 12,
        maximumDurationMonths: 84,
        durationStepMonths: 1,
        durationTerms: null,
        firstInstallmentDelayDays: [30],
        customerTanPercent: 10.5,
        isActive: true,
      },
      {
        id: "t-des",
        companyId: "c-agos",
        productId: "p-agos",
        tableCode: "DES_ONLY",
        displayName: "DES Only",
        category: "standard",
        network: "DES",
        minimumAmount: 1000,
        maximumAmount: 5000,
        minimumDurationMonths: 12,
        maximumDurationMonths: 24,
        durationStepMonths: 12,
        firstInstallmentDelayDays: [30],
        customerTanPercent: 9,
        isActive: true,
      },
      {
        id: "t-inactive",
        companyId: "c-inactive",
        productId: "p-agos",
        tableCode: "OFF",
        displayName: "Off",
        category: "standard",
        network: "PCG",
        minimumAmount: 100,
        maximumAmount: 100,
        minimumDurationMonths: 6,
        maximumDurationMonths: 6,
        durationStepMonths: 6,
        firstInstallmentDelayDays: [30],
        customerTanPercent: 0,
        isActive: false,
      },
    ],
    policySets: [
      {
        id: "ps-agos-age",
        name: "Agos età",
        network: "PCG",
        companyId: "c-agos",
        isActive: true,
      },
      {
        id: "ps-db-age",
        name: "DB età",
        network: "PCG",
        companyId: "c-db",
        isActive: true,
      },
      {
        id: "ps-compass-permit",
        name: "Compass permesso",
        network: "PCG",
        companyId: "c-compass",
        isActive: true,
      },
      {
        id: "ps-expired",
        name: "Scaduta",
        network: "PCG",
        companyId: "c-agos",
        isActive: true,
        validTo: Date.UTC(2020, 0, 1),
      },
      {
        id: "ps-des",
        name: "DES età",
        network: "DES",
        companyId: "c-agos",
        isActive: true,
      },
    ],
    policyRules: [
      {
        policySetId: "ps-agos-age",
        ruleType: "maximum_age_at_application",
        operator: "less_than_or_equal",
        numericValue: 75,
        failureMessage: "Età massima Agos al caricamento superata",
        isActive: true,
        sortOrder: 1,
      },
      {
        policySetId: "ps-db-age",
        ruleType: "maximum_age_at_end",
        operator: "less_than_or_equal",
        numericValue: 80,
        failureMessage: "Età massima DB a fine piano superata",
        isActive: true,
        sortOrder: 1,
      },
      {
        policySetId: "ps-compass-permit",
        ruleType: "non_eu_allowed",
        operator: "equals",
        booleanValue: true,
        failureMessage: "Verificare permesso di soggiorno Compass",
        verificationMessage: "Verificare ricevuta di rinnovo se applicabile",
        isActive: true,
        sortOrder: 1,
      },
      {
        policySetId: "ps-expired",
        ruleType: "maximum_age_at_application",
        operator: "less_than_or_equal",
        numericValue: 99,
        failureMessage: "Policy scaduta non deve apparire",
        isActive: true,
        sortOrder: 1,
      },
      {
        policySetId: "ps-des",
        ruleType: "maximum_age_at_application",
        operator: "less_than_or_equal",
        numericValue: 70,
        failureMessage: "Policy DES non deve apparire su PCG",
        isActive: true,
        sortOrder: 1,
      },
      {
        policySetId: "ps-agos-age",
        ruleType: "employment_type_allowed",
        operator: "in",
        stringValues: ["permanent_employee", "temporary_employee"],
        failureMessage: "Tipo di occupazione non ammesso",
        isActive: true,
        sortOrder: 2,
      },
    ],
    ...overrides,
  };
}

describe("buildPreScreeningContext", () => {
  it("usa solo tabelle/prodotti attivi della rete e durationTerms quando presenti", () => {
    const emptyMatched = {
      companyIds: [],
      productIds: [],
      tableIds: [],
      networks: [] as Array<"PCG" | "DES">,
      matchedLabels: [],
    };
    const context = buildPreScreeningContext({
      intents: ["duration"],
      matched: emptyMatched,
      source: fixtureSource(),
    });
    const codes = context.tables.map((table) => table.tableCode);
    expect(codes).toContain("NBQ");
    expect(codes).toContain("S/U");
    expect(codes).toContain("81K");
    expect(codes).not.toContain("DES_ONLY");
    expect(codes).not.toContain("OFF");

    const su = context.tables.find((table) => table.tableCode === "S/U");
    expect(su?.allowedDurations).toEqual([24, 36, 48, 60, 72]);
    expect(su?.allowedDurations).not.toContain(30);

    const nbq = context.tables.find((table) => table.tableCode === "NBQ");
    expect(nbq?.allowedDurations).toContain(84);
    expect(nbq?.allowedDurations.at(-1)).toBe(84);
  });

  it("esclude policy scadute e di network diverso", () => {
    const context = buildPreScreeningContext({
      intents: ["age"],
      matched: {
        companyIds: [],
        productIds: [],
        tableIds: [],
        networks: [],
        matchedLabels: [],
      },
      source: fixtureSource(),
    });
    const messages = context.policyRules.map((rule) => rule.failureMessage);
    expect(messages.some((item) => item.includes("Agos"))).toBe(true);
    expect(messages).not.toContain("Policy scaduta non deve apparire");
    expect(messages).not.toContain("Policy DES non deve apparire su PCG");
  });

  it("non hardcoda finanziarie: il catalogo deriva dai dati", () => {
    const catalog = buildEntityCatalogFromActiveData({
      companies: [
        { id: "c-db", name: "Deutsche Bank", shortName: "Deutsche Bank" },
      ],
      products: [],
      tables: [],
    });
    const matched = matchEntitiesFromQuestion("limite età DB", catalog);
    expect(matched.companyIds).toEqual(["c-db"]);
    expect(matched.matchedLabels.length).toBeGreaterThan(0);
  });

  it("filtra per intent età: include policy età, non forza numeri nel codice", () => {
    const context = buildPreScreeningContext({
      intents: ["age"],
      matched: {
        companyIds: [],
        productIds: [],
        tableIds: [],
        networks: [],
        matchedLabels: [],
      },
      source: fixtureSource(),
    });
    expect(
      context.policyRules.every(
        (rule) =>
          rule.ruleType.includes("age") ||
          rule.ruleType.includes("duration"),
      ),
    ).toBe(true);
    const text = formatPreScreeningContext(context);
    expect(text).toContain("CONTESTO PRE-SCREENING");
    expect(text).toContain("Intent rilevati: age");
    // I valori numerici arrivano dal fixture/DB, non da costanti del modulo
    expect(text).toContain("valore=75");
    expect(text).toContain("valore=80");
  });
});

describe("pre-screening privacy e provider context sufficiency", () => {
  const emptyMatched = {
    companyIds: [] as string[],
    productIds: [] as string[],
    tableIds: [] as string[],
    networks: [] as Array<"PCG" | "DES">,
    matchedLabels: [] as string[],
  };

  it("A/B/C/D/E/F/G: contesto sufficiente senza PII/commerciali", () => {
    const cases: Array<{ q: string; mustInclude: string[] }> = [
      {
        q: "Ho un paziente di 80 anni",
        mustInclude: ["age", "maximum_age"],
      },
      {
        q: "Ho un paziente extracomunitario",
        mustInclude: ["residence_permit", "non_eu"],
      },
      {
        q: "Ha un contratto a tempo determinato",
        mustInclude: ["employment", "employment_type"],
      },
      {
        q: "Quale finanziaria arriva a 84 rate?",
        mustInclude: ["duration", "84"],
      },
      {
        q: "Devo finanziare 25.000 €",
        mustInclude: ["amount", "30000"],
      },
      {
        q: "Qual è il limite massimo di età con Deutsche Bank?",
        mustInclude: ["age", "Deutsche Bank", "maximum_age"],
      },
      {
        q: "Compass accetta la ricevuta di rinnovo del permesso?",
        mustInclude: ["residence_permit", "Compass", "ricevuta"],
      },
    ];

    for (const item of cases) {
      const intents = detectPreScreeningIntents(item.q);
      const catalog = buildEntityCatalogFromActiveData({
        companies: fixtureSource().companies.map((c) => ({
          id: c.id,
          name: c.name,
          shortName: c.shortName,
        })),
        products: fixtureSource().products.map((p) => ({
          id: p.id,
          companyId: p.companyId,
          name: p.name,
          code: p.code,
        })),
        tables: fixtureSource().tables
          .filter((t) => t.isActive !== false && t.network === "PCG")
          .map((t) => ({
            id: t.id,
            companyId: t.companyId,
            productId: t.productId,
            tableCode: t.tableCode,
            displayName: t.displayName,
            network: t.network,
          })),
      });
      const matched = matchEntitiesFromQuestion(item.q, catalog);
      const context = buildPreScreeningContext({
        intents,
        matched,
        source: fixtureSource(),
      });
      const text = formatPreScreeningContext(context);
      expect(assertPreScreeningPrivacy(text)).toEqual([]);
      expect(text).not.toMatch(/Mario|Rossi|codice fiscale|IBAN|provvigione|rappel|adminNotes/i);
      for (const token of item.mustInclude) {
        expect(text.toLowerCase()).toContain(token.toLowerCase());
      }
    }
  });

  it("senza simulazione allega pre-screening solo per finanziabilità", () => {
    expect(
      shouldAttachPreScreening({
        hasSimulationContext: false,
        intents: ["generic"],
        matched: emptyMatched,
        userQuestion: "Ciao",
      }),
    ).toBe(false);
    expect(
      shouldAttachPreScreening({
        hasSimulationContext: false,
        intents: ["employment", "amount"],
        matched: emptyMatched,
        userQuestion: "devo finanziare uno studente per 2000€",
      }),
    ).toBe(true);
  });

  it("domanda procedurale liquidazione non allega pre-screening", () => {
    expect(
      shouldAttachPreScreening({
        hasSimulationContext: false,
        intents: ["generic"],
        matched: {
          ...emptyMatched,
          companyIds: ["c-compass", "c-agos"],
          matchedLabels: ["Compass", "Agos"],
        },
        userQuestion: "come liquido una pratica compass e una agos?",
      }),
    ).toBe(false);
  });

  it("con simulazione allega pre-screening per domande su permesso", () => {
    expect(
      shouldAttachPreScreening({
        hasSimulationContext: true,
        intents: ["residence_permit"],
        matched: emptyMatched,
      }),
    ).toBe(true);
  });
});

describe("regressione studente importo – esclusione Agos prima delle tabelle", () => {
  function studentPolicySource(): PreScreeningSourceData {
    const base = fixtureSource();
    return {
      ...base,
      policySets: [
        {
          id: "ps-agos-student",
          name: "PCG Agos studente",
          network: "PCG",
          companyId: "c-agos",
          isActive: true,
        },
        {
          id: "ps-compass-student",
          name: "PCG Compass studente",
          network: "PCG",
          companyId: "c-compass",
          isActive: true,
        },
        {
          id: "ps-db-student",
          name: "PCG DB studente",
          network: "PCG",
          companyId: "c-db",
          isActive: true,
        },
      ],
      policyRules: [
        {
          policySetId: "ps-agos-student",
          ruleType: "employment_type_allowed",
          operator: "not_in",
          stringValues: ["student", "housewife"],
          failureMessage:
            "Agos non valuta profili studente o casalinga secondo le indicazioni aziendali PCG disponibili.",
          isActive: true,
          sortOrder: 1,
        },
        {
          policySetId: "ps-compass-student",
          ruleType: "maximum_amount_for_employment_types",
          operator: "less_than_or_equal",
          numericValue: 2500,
          stringValues: ["student", "housewife"],
          failureMessage:
            "Per studente/casalinga Compass ammette un importo massimo di 2.500 € sul profilo dichiarato.",
          isActive: true,
          sortOrder: 1,
        },
        {
          policySetId: "ps-compass-student",
          ruleType: "guarantor_required_for_employment_types",
          operator: "custom",
          stringValues: ["student"],
          failureMessage:
            "Per uno studente Compass richiede un garante con reddito dimostrabile.",
          verificationMessage:
            "Per uno studente Compass richiede un garante con reddito dimostrabile. La documentazione deve essere verificata dalla finanziaria.",
          isActive: true,
          sortOrder: 2,
        },
        {
          policySetId: "ps-db-student",
          ruleType: "maximum_amount_for_employment_types",
          operator: "less_than_or_equal",
          numericValue: 2500,
          stringValues: ["student", "housewife"],
          failureMessage:
            "Per studente/casalinga Deutsche Bank ammette un importo massimo di 2.500 € sul profilo dichiarato.",
          isActive: true,
          sortOrder: 1,
        },
      ],
    };
  }

  it("studente 2000€: Agos esclusa, Compass verification, DB valutabile, niente tabelle Agos", () => {
    const question =
      "devo finanziare uno studente per 2000€ come posso fare?";
    const intents = detectPreScreeningIntents(question);
    expect(intents).toEqual(
      expect.arrayContaining(["employment", "amount"]),
    );

    const context = buildPreScreeningContext({
      intents,
      matched: {
        companyIds: [],
        productIds: [],
        tableIds: [],
        networks: [],
        matchedLabels: [],
      },
      source: studentPolicySource(),
      question,
    });

    const types = context.policyRules.map((rule) => rule.ruleType);
    expect(types).toContain("employment_type_allowed");
    expect(types).toContain("maximum_amount_for_employment_types");
    expect(types).toContain("guarantor_required_for_employment_types");

    const text = formatPreScreeningContext(context, { question });
    expect(text).toMatch(/Agos: ESCLUSA/i);
    expect(text).toMatch(/Compass: DA VERIFICARE/i);
    expect(text).toMatch(/Deutsche Bank: potenzialmente valutabile/i);
    expect(text).not.toMatch(/non è disponibile una policy strutturata/i);
    expect(text).not.toMatch(/Nessuna policy strutturata attiva/i);

    const codes = context.tables.map((table) => table.tableCode);
    expect(codes).not.toContain("NBQ");
    expect(codes).not.toContain("NBS");
    expect(codes).toContain("81K");
    // S/U ha minimo 2.600 €: correttamente esclusa per importo 2.000
    expect(codes).not.toContain("S/U");
    expect(
      context.tables.every((table) => table.companyId !== "c-agos"),
    ).toBe(true);
  });

  it("studente 3000€: Agos/Compass/DB esclusi, nessuna tabella candidata", () => {
    const question = "sono uno studente e devo finanziare 3000€";
    const intents = detectPreScreeningIntents(question);
    const context = buildPreScreeningContext({
      intents,
      matched: {
        companyIds: [],
        productIds: [],
        tableIds: [],
        networks: [],
        matchedLabels: [],
      },
      source: studentPolicySource(),
      question,
    });
    const text = formatPreScreeningContext(context, { question });
    expect(text).toMatch(/Agos: ESCLUSA/i);
    expect(text).toMatch(/Compass: ESCLUSA/i);
    expect(text).toMatch(/Deutsche Bank: ESCLUSA/i);
    expect(context.tables).toHaveLength(0);
  });

  it("casalinga 2000€: Agos esclusa, Compass/DB valutabili", () => {
    const question = "devo finanziare una casalinga per 2000€";
    const intents = detectPreScreeningIntents(question);
    const context = buildPreScreeningContext({
      intents,
      matched: {
        companyIds: [],
        productIds: [],
        tableIds: [],
        networks: [],
        matchedLabels: [],
      },
      source: studentPolicySource(),
      question,
    });
    const text = formatPreScreeningContext(context, { question });
    expect(text).toMatch(/Agos: ESCLUSA/i);
    expect(text).toMatch(/Compass: potenzialmente valutabile/i);
    expect(text).toMatch(/Deutsche Bank: potenzialmente valutabile/i);
    expect(
      context.tables.every((table) => table.companyId !== "c-agos"),
    ).toBe(true);
  });
});
