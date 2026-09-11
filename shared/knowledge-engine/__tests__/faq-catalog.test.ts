import { describe, expect, it } from "vitest";
import { PCG_FINANCING_POLICY_SETS_2026 } from "../../../convex/lib/pcgFinancingPolicies2026Data.ts";
import { PCG_2026_POLICY_CONSTANTS as C } from "../../policy-engine/pcg-2026-constants.ts";
import {
  buildFaqEntries,
  filterFaqByCategory,
  FAQ_CATEGORY_ORDER,
  listFaqCategories,
  searchFaqEntries,
} from "../faq.ts";
import { PCG_KNOWLEDGE_CARDS_2026 } from "../officialPcgCards2026.ts";
import type { FaqKnowledgeCard } from "../faq.ts";

function seedAsRuntimeCards(): FaqKnowledgeCard[] {
  return PCG_KNOWLEDGE_CARDS_2026.map((seed, index) => ({
    id: `seed-${seed.seedKey}`,
    title: seed.title,
    content: seed.content,
    category: seed.category,
    network: seed.network,
    keywords: seed.keywords,
    priority: seed.priority,
    alwaysInclude: seed.alwaysInclude ?? false,
    isAlert: seed.isAlert ?? false,
    alertLabel: seed.alertLabel,
    visibility: seed.visibility,
    isActive: true,
    version: 1,
    showInFaq: seed.showInFaq,
    faqQuestion: seed.faqQuestion,
    faqCategory: seed.faqCategory,
    faqOrder: seed.faqOrder,
    // simulate superseded sibling for one card
    ...(index === 0
      ? {}
      : {}),
  }));
}

describe("FAQ catalog PCG 2026 – ampliamento", () => {
  const cards = seedAsRuntimeCards();
  const entries = buildFaqEntries(cards);

  it("1) almeno 28 FAQ disponibili dopo seed", () => {
    expect(entries.length).toBeGreaterThanOrEqual(28);
    expect(entries.length).toBeLessThanOrEqual(40);
  });

  it("2) nessun duplicato faqQuestion", () => {
    const questions = entries.map((entry) => entry.question);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it("3) nessuna card superseded visibile", () => {
    const withSuperseded = [
      ...cards,
      {
        ...cards[0]!,
        id: "old-superseded",
        isActive: true,
        showInFaq: true,
        faqQuestion: "Vecchia FAQ superseded",
        faqCategory: "Agos",
        faqOrder: 1,
        version: 1,
      },
      {
        ...cards[0]!,
        id: "new-current",
        isActive: true,
        showInFaq: true,
        faqQuestion: "Nuova FAQ corrente",
        faqCategory: "Agos",
        faqOrder: 2,
        version: 2,
        supersedesCardId: "old-superseded",
      },
    ];
    const result = buildFaqEntries(withSuperseded);
    expect(result.some((item) => item.id === "old-superseded")).toBe(false);
    expect(result.some((item) => item.id === "new-current")).toBe(true);
  });

  it("4) solo showInFaq=true", () => {
    expect(
      PCG_KNOWLEDGE_CARDS_2026.filter((card) => card.showInFaq).length,
    ).toBe(entries.length);
    expect(
      PCG_KNOWLEDGE_CARDS_2026.some(
        (card) => card.showInFaq !== true && card.faqQuestion,
      ),
    ).toBe(false);
  });

  it("5) categorie corrette e non vuote", () => {
    const categories = listFaqCategories(entries);
    for (const category of categories) {
      expect(FAQ_CATEGORY_ORDER).toContain(category);
      expect(entries.some((entry) => entry.category === category)).toBe(true);
    }
    expect(categories[0]).toBe("Requisiti paziente");
  });

  it("6) ricerca Agos / garante / extracomunitario / liquidazione / documento reddito", () => {
    expect(searchFaqEntries(entries, "Agos").length).toBeGreaterThan(0);
    expect(searchFaqEntries(entries, "garante").length).toBeGreaterThan(0);
    expect(searchFaqEntries(entries, "extracomunitario").length).toBeGreaterThan(
      0,
    );
    expect(searchFaqEntries(entries, "liquidazione").length).toBeGreaterThan(0);
    expect(
      searchFaqEntries(entries, "documento reddito").length,
    ).toBeGreaterThan(0);
  });

  it("7) filtro categoria Agos", () => {
    const agos = filterFaqByCategory(entries, "Agos");
    expect(agos.length).toBeGreaterThan(0);
    expect(agos.every((entry) => entry.category === "Agos")).toBe(true);
  });

  it("8) FAQ Compass liquidazione senza vecchio testo piano firmato", () => {
    const compass = entries.find((entry) =>
      entry.question.toLowerCase().includes("liquidazione compass"),
    );
    expect(compass).toBeTruthy();
    expect(compass!.answer.toLowerCase()).not.toMatch(
      /piano firmato dal paziente e dal medico/,
    );
    expect(compass!.answer.toLowerCase()).toMatch(/e-mail|email/);
  });

  it("9) policy FAQ coerenti con policy seed / costanti", () => {
    const agosSet = PCG_FINANCING_POLICY_SETS_2026.find(
      (item) => item.companyShortName === "Agos",
    )!;
    const minAge = agosSet.rules.find((rule) => rule.ruleType === "minimum_age");
    expect(minAge?.numericValue).toBe(C.minimumAge);

    const ageFaq = entries.find((entry) =>
      entry.question.includes("età minima"),
    );
    expect(ageFaq?.answer).toContain(String(C.minimumAge));

    const studentFaq = entries.find((entry) =>
      entry.question.toLowerCase().includes("studente"),
    );
    expect(studentFaq?.answer).toContain(
      C.studentHousewifeMaxAmountEur.toLocaleString("it-IT"),
    );

    const incomeFaq = entries.find((entry) =>
      entry.question.toLowerCase().includes("esenzione dal documento"),
    );
    expect(incomeFaq?.answer.toLowerCase()).toMatch(
      /importo richiesto e spese finanziate/,
    );
  });

  it("10) seed keys unici (idempotenza: nessuna doppia seedKey)", () => {
    const keys = PCG_KNOWLEDGE_CARDS_2026.map((card) => card.seedKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
