import { describe, expect, it } from "vitest";
import {
  formatKnowledgeContext,
  normalizeKeywords,
  normalizeText,
  selectRelevantKnowledgeCards,
  tokenizeQuestion,
  type RuntimeKnowledgeCard,
} from "../index.ts";

function card(
  partial: Partial<RuntimeKnowledgeCard> &
    Pick<RuntimeKnowledgeCard, "id" | "title" | "content">,
): RuntimeKnowledgeCard {
  return {
    id: partial.id,
    title: partial.title,
    content: partial.content,
    category: partial.category ?? "faq",
    network: partial.network ?? "BOTH",
    companyId: partial.companyId,
    productId: partial.productId,
    financialTableId: partial.financialTableId,
    keywords: partial.keywords ?? [],
    priority: partial.priority ?? 50,
    alwaysInclude: partial.alwaysInclude ?? false,
    isAlert: partial.isAlert ?? false,
    alertLabel: partial.alertLabel,
    visibility: partial.visibility,
    isActive: partial.isActive ?? true,
    validFrom: partial.validFrom,
    validTo: partial.validTo,
    version: partial.version ?? 1,
  };
}

const now = Date.UTC(2026, 6, 31);

describe("normalize", () => {
  it("porta keyword in minuscolo e trim", () => {
    expect(normalizeKeywords(["  Liquidazione ", "RATA"])).toEqual([
      "liquidazione",
      "rata",
    ]);
  });

  it("rimuove duplicati e vuoti", () => {
    expect(normalizeKeywords(["rata", "Rata", "  ", "addebito"])).toEqual([
      "rata",
      "addebito",
    ]);
  });

  it("normalizza accenti e punteggiatura", () => {
    expect(normalizeText("Liquidazione!! pensione d’invalidità")).toBe(
      "liquidazione pensione d invalidita",
    );
  });

  it("gestisce domanda vuota", () => {
    expect(tokenizeQuestion("")).toEqual([]);
    expect(tokenizeQuestion(undefined)).toEqual([]);
  });
});

describe("rete", () => {
  const cards = [
    card({ id: "pcg", title: "PCG", content: "x", network: "PCG", priority: 10 }),
    card({ id: "des", title: "DES", content: "x", network: "DES", priority: 10 }),
    card({ id: "both", title: "BOTH", content: "x", network: "BOTH", priority: 10 }),
  ];

  it("seleziona PCG e BOTH", () => {
    const result = selectRelevantKnowledgeCards(cards, {
      network: "PCG",
      calculationDate: now,
    });
    expect(result.selectedCards.map((item) => item.id).sort()).toEqual([
      "both",
      "pcg",
    ]);
  });

  it("seleziona DES e BOTH", () => {
    const result = selectRelevantKnowledgeCards(cards, {
      network: "DES",
      calculationDate: now,
    });
    expect(result.selectedCards.map((item) => item.id).sort()).toEqual([
      "both",
      "des",
    ]);
  });

  it("esclude rete non coerente", () => {
    const result = selectRelevantKnowledgeCards(
      [card({ id: "des", title: "DES", content: "x", network: "DES" })],
      { network: "PCG", calculationDate: now },
    );
    expect(result.selectedCards).toHaveLength(0);
  });
});

describe("scope", () => {
  it("applica generale, finanziaria, prodotto, tabella", () => {
    const cards = [
      card({ id: "g", title: "Gen", content: "g", priority: 10 }),
      card({
        id: "c",
        title: "Comp",
        content: "c",
        companyId: "comp-1",
        priority: 10,
      }),
      card({
        id: "p",
        title: "Prod",
        content: "p",
        productId: "prod-1",
        priority: 10,
      }),
      card({
        id: "t",
        title: "Tab",
        content: "t",
        financialTableId: "tab-1",
        priority: 10,
      }),
      card({
        id: "other",
        title: "Other",
        content: "o",
        companyId: "comp-2",
        priority: 90,
      }),
    ];

    const result = selectRelevantKnowledgeCards(cards, {
      network: "PCG",
      companyId: "comp-1",
      productId: "prod-1",
      financialTableId: "tab-1",
      calculationDate: now,
    });

    const ids = result.selectedCards.map((item) => item.id);
    expect(ids).toContain("g");
    expect(ids).toContain("c");
    expect(ids).toContain("p");
    expect(ids).toContain("t");
    expect(ids).not.toContain("other");
  });
});

describe("validità", () => {
  it("esclude inattive, future e scadute", () => {
    const cards = [
      card({ id: "ok", title: "Ok", content: "x", isActive: true }),
      card({ id: "off", title: "Off", content: "x", isActive: false }),
      card({
        id: "future",
        title: "Future",
        content: "x",
        validFrom: now + 86_400_000,
      }),
      card({
        id: "expired",
        title: "Expired",
        content: "x",
        validTo: now - 86_400_000,
      }),
    ];
    const result = selectRelevantKnowledgeCards(cards, {
      network: "PCG",
      calculationDate: now,
    });
    expect(result.selectedCards.map((item) => item.id)).toEqual(["ok"]);
  });
});

describe("ranking", () => {
  it("alwaysInclude prima, poi specificità e keyword", () => {
    const cards = [
      card({
        id: "kw",
        title: "Keyword",
        content: "x",
        keywords: ["liquidazione"],
        priority: 10,
      }),
      card({
        id: "company",
        title: "Company",
        content: "x",
        companyId: "c1",
        priority: 10,
      }),
      card({
        id: "product",
        title: "Product",
        content: "x",
        productId: "p1",
        priority: 10,
      }),
      card({
        id: "table",
        title: "Table",
        content: "x",
        financialTableId: "t1",
        priority: 10,
      }),
      card({
        id: "always",
        title: "Always",
        content: "x",
        alwaysInclude: true,
        priority: 1,
      }),
      card({
        id: "title",
        title: "Liquidazione speciale",
        content: "x",
        priority: 5,
      }),
    ];

    const result = selectRelevantKnowledgeCards(cards, {
      network: "PCG",
      companyId: "c1",
      productId: "p1",
      financialTableId: "t1",
      userQuestion: "Come funziona la liquidazione?",
      calculationDate: now,
    });

    expect(result.selectedCards[0]?.id).toBe("always");
    const order = result.selectedCards.map((item) => item.id);
    expect(order.indexOf("table")).toBeLessThan(order.indexOf("product"));
    expect(order.indexOf("product")).toBeLessThan(order.indexOf("company"));
  });
});

describe("limiti", () => {
  it("rispetta maxCards e emette warning", () => {
    const cards = Array.from({ length: 5 }, (_, index) =>
      card({
        id: `c${index}`,
        title: `Card ${index}`,
        content: "contenuto",
        priority: 100 - index,
      }),
    );
    const result = selectRelevantKnowledgeCards(
      cards,
      { network: "PCG", calculationDate: now },
      { maxCards: 2, maxCharacters: 18_000 },
    );
    expect(result.selectedCards).toHaveLength(2);
    expect(result.excludedByLimitCount).toBe(3);
    expect(result.warnings[0]).toMatch(/escluse/);
  });

  it("non tronca schede e include alwaysInclude oltre limite se sola", () => {
    const huge = "x".repeat(500);
    const result = selectRelevantKnowledgeCards(
      [
        card({
          id: "big",
          title: "Big",
          content: huge,
          alwaysInclude: true,
          priority: 1,
        }),
      ],
      { network: "PCG", calculationDate: now },
      { maxCards: 12, maxCharacters: 200 },
    );
    expect(result.selectedCards).toHaveLength(1);
    expect(result.selectedCards[0]?.content).toHaveLength(500);
    expect(result.warnings.some((item) => item.includes("supera"))).toBe(true);
  });
});

describe("visibilità privacy", () => {
  it("patient_safe esclude internal_only e schede senza campo", () => {
    const cards = [
      card({
        id: "safe",
        title: "Safe",
        content: "x",
        visibility: "patient_safe",
      }),
      card({
        id: "internal",
        title: "Internal",
        content: "x",
        visibility: "internal_only",
        priority: 99,
      }),
      card({ id: "legacy", title: "Legacy", content: "x", priority: 98 }),
    ];
    const result = selectRelevantKnowledgeCards(cards, {
      network: "PCG",
      calculationDate: now,
      privacyMode: "patient_safe",
    });
    expect(result.selectedCards.map((item) => item.id)).toEqual(["safe"]);
  });
});

describe("versioni", () => {
  it("considera solo la versione attiva e non duplica lo storico", () => {
    const cards = [
      card({
        id: "v1",
        title: "Procedura",
        content: "vecchia",
        isActive: false,
        version: 1,
        priority: 99,
      }),
      card({
        id: "v2",
        title: "Procedura",
        content: "nuova",
        isActive: true,
        version: 2,
        supersedesCardId: "v1",
        priority: 50,
      }),
    ];
    const result = selectRelevantKnowledgeCards(cards, {
      network: "PCG",
      calculationDate: now,
    });
    expect(result.selectedCards).toHaveLength(1);
    expect(result.selectedCards[0]?.id).toBe("v2");
    expect(result.selectedCards[0]?.content).toBe("nuova");
  });
});

describe("format context", () => {
  it("costruisce testo BASE DI CONOSCENZA", () => {
    const result = selectRelevantKnowledgeCards(
      [card({ id: "1", title: "Demo", content: "Testo demo", category: "faq" })],
      { network: "PCG", calculationDate: now },
    );
    const text = formatKnowledgeContext(result.selectedCards);
    expect(text).toContain("BASE DI CONOSCENZA AZIENDALE");
    expect(text).toContain("[SCHEDA 1]");
    expect(text).toContain("Demo");
  });
});
