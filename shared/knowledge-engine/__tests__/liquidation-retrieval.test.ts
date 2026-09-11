import { describe, expect, it } from "vitest";
import {
  filterCurrentKnowledgeVersions,
  formatKnowledgeContext,
  PCG_KNOWLEDGE_CARDS_2026,
  selectRelevantKnowledgeCards,
  type RuntimeKnowledgeCard,
} from "../index.ts";
import {
  buildEntityCatalogFromActiveData,
  isProceduralKnowledgeQuestion,
  matchEntitiesFromQuestion,
  shouldAttachPreScreening,
} from "../../assistant-context/index.ts";

const now = Date.UTC(2026, 8, 11);

const COMPANY = {
  agos: "company-agos",
  compass: "company-compass",
  db: "company-db",
} as const;

function officialCards(): RuntimeKnowledgeCard[] {
  return PCG_KNOWLEDGE_CARDS_2026.map((seed) => ({
    id: `official-${seed.seedKey}`,
    title: seed.title,
    content: seed.content,
    category: seed.category,
    network: seed.network,
    companyId:
      seed.companyShortName === "Agos"
        ? COMPANY.agos
        : seed.companyShortName === "Compass"
          ? COMPANY.compass
          : seed.companyShortName === "Deutsche Bank"
            ? COMPANY.db
            : undefined,
    productId: seed.productName === "Agos Pass" ? "product-agos-pass" : undefined,
    keywords: seed.keywords.map((item) => item.toLowerCase()),
    priority: seed.priority,
    alwaysInclude: seed.alwaysInclude ?? false,
    isAlert: seed.isAlert ?? false,
    alertLabel: seed.alertLabel,
    visibility: seed.visibility,
    isActive: true,
    version: 2,
  }));
}

function select(question: string, companyIds: string[]) {
  return selectRelevantKnowledgeCards(
    officialCards(),
    {
      network: "PCG",
      companyIds,
      userQuestion: question,
      calculationDate: now,
      privacyMode: "internal",
    },
    { maxCards: 12, maxCharacters: 24_000 },
  );
}

const catalog = buildEntityCatalogFromActiveData({
  companies: [
    { id: COMPANY.agos, name: "Agos", shortName: "Agos" },
    { id: COMPANY.compass, name: "Compass", shortName: "Compass" },
    { id: COMPANY.db, name: "Deutsche Bank", shortName: "Deutsche Bank" },
  ],
  products: [],
  tables: [],
});

describe("retrieval liquidazione multi-finanziaria", () => {
  it("A: compass + agos recupera entrambe le card correnti senza testo superseded", () => {
    const question = "come liquido una pratica compass e una agos?";
    const matched = matchEntitiesFromQuestion(question, catalog);
    expect(matched.companyIds).toEqual(
      expect.arrayContaining([COMPANY.compass, COMPANY.agos]),
    );
    expect(matched.companyIds).toHaveLength(2);

    const result = select(question, matched.companyIds);
    const text = formatKnowledgeContext(result.selectedCards);
    const titles = result.selectedCards.map((card) => card.title);

    expect(titles).toContain("Compass – procedura di liquidazione");
    expect(titles).toContain("Agos – liquidazione e fattura 48h");
    expect(text).toMatch(/filiale Compass di riferimento/i);
    expect(text).toMatch(/auto-liquidazione/i);
    expect(text).toMatch(/PrimoUp/i);
    expect(text).not.toMatch(/piano firmato dal paziente e dal medico/i);
    expect(isProceduralKnowledgeQuestion(question)).toBe(true);
    expect(
      shouldAttachPreScreening({
        hasSimulationContext: false,
        intents: ["generic"],
        matched,
        userQuestion: question,
      }),
    ).toBe(false);
  });

  it("B: liquidazione DB recupera richiesta via mail alla filiale", () => {
    const question = "come liquido una pratica db?";
    const matched = matchEntitiesFromQuestion(question, catalog);
    expect(matched.companyIds).toContain(COMPANY.db);

    const result = select(question, matched.companyIds);
    const text = formatKnowledgeContext(result.selectedCards);
    expect(text).toMatch(/Deutsche Bank – procedura di liquidazione/);
    expect(text).toMatch(/filiale Deutsche Bank di riferimento/i);
    expect(text).not.toMatch(/piano firmato/i);
  });

  it("C: compass + db + agos recupera 3 card", () => {
    const question = "come liquido compass, db e agos?";
    const matched = matchEntitiesFromQuestion(question, catalog);
    expect(matched.companyIds).toHaveLength(3);

    const result = select(question, matched.companyIds);
    const titles = result.selectedCards.map((card) => card.title);
    expect(titles).toContain("Compass – procedura di liquidazione");
    expect(titles).toContain("Deutsche Bank – procedura di liquidazione");
    expect(titles).toContain("Agos – liquidazione e fattura 48h");
  });

  it("D: fattura Agos recupera card 48h", () => {
    const question = "entro quanto carico la fattura Agos?";
    const result = select(question, [COMPANY.agos]);
    const text = formatKnowledgeContext(result.selectedCards);
    expect(text).toMatch(/Agos – liquidazione e fattura 48h/);
    expect(text).toMatch(/48 ore/i);
  });

  it("E: versioning – solo v2 attiva entra nel retrieval", () => {
    const v1: RuntimeKnowledgeCard = {
      id: "compass-v1",
      title: "Compass – procedura di liquidazione",
      content:
        "OLD: inviare via e-mail il piano firmato dal paziente e dal medico",
      category: "liquidation",
      network: "PCG",
      companyId: COMPANY.compass,
      keywords: ["compass", "liquidazione", "piano firmato"],
      priority: 85,
      alwaysInclude: false,
      isAlert: false,
      visibility: "internal_only",
      isActive: true,
      version: 1,
    };
    const v2: RuntimeKnowledgeCard = {
      id: "compass-v2",
      title: "Compass – procedura di liquidazione",
      content:
        "Per liquidare una pratica Compass, il Clinic Manager deve inviare una richiesta via e-mail alla filiale Compass di riferimento.",
      category: "liquidation",
      network: "PCG",
      companyId: COMPANY.compass,
      keywords: ["compass", "liquidazione", "filiale"],
      priority: 85,
      alwaysInclude: false,
      isAlert: false,
      visibility: "internal_only",
      isActive: true,
      version: 2,
      supersedesCardId: "compass-v1",
    };

    const current = filterCurrentKnowledgeVersions([v1, v2]);
    expect(current.map((card) => card.id)).toEqual(["compass-v2"]);

    const result = selectRelevantKnowledgeCards([v1, v2], {
      network: "PCG",
      companyIds: [COMPANY.compass],
      userQuestion: "come liquido compass?",
      calculationDate: now,
      privacyMode: "internal",
    });
    expect(result.selectedCards).toHaveLength(1);
    expect(result.selectedCards[0]?.id).toBe("compass-v2");
    expect(result.selectedCards[0]?.content).not.toMatch(/piano firmato/);
  });
});
