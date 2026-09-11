import { describe, expect, it } from "vitest";
import {
  buildFaqEntries,
  searchFaqEntries,
} from "../faq.ts";
import type { RuntimeKnowledgeCard } from "../types.ts";

function card(
  partial: Partial<RuntimeKnowledgeCard> & {
    id: string;
    title: string;
    showInFaq?: boolean;
    faqQuestion?: string;
    faqCategory?: string;
    faqOrder?: number;
    supersedesCardId?: string;
  },
): RuntimeKnowledgeCard & {
  showInFaq?: boolean;
  faqQuestion?: string;
  faqCategory?: string;
  faqOrder?: number;
} {
  return {
    content: partial.content ?? "Contenuto operativo",
    category: partial.category ?? "documents",
    network: partial.network ?? "PCG",
    keywords: partial.keywords ?? ["test"],
    priority: partial.priority ?? 50,
    alwaysInclude: false,
    isAlert: false,
    isActive: partial.isActive ?? true,
    version: partial.version ?? 1,
    ...partial,
  };
}

describe("FAQ knowledge cards", () => {
  it("I) solo active + showInFaq, esclude superseded, ricerca funzionante", () => {
    const cards = [
      card({
        id: "old",
        title: "Vecchia",
        isActive: true,
        showInFaq: true,
        faqQuestion: "Come liquidare Compass?",
        faqCategory: "Compass",
        version: 1,
      }),
      card({
        id: "new",
        title: "Nuova Compass",
        isActive: true,
        showInFaq: true,
        faqQuestion: "Come richiedo la liquidazione Compass?",
        faqCategory: "Compass",
        faqOrder: 1,
        version: 2,
        supersedesCardId: "old",
        content: "Inviare email alla filiale Compass.",
        keywords: ["compass", "liquidazione"],
      }),
      card({
        id: "hidden",
        title: "Solo Virtual Marco",
        isActive: true,
        showInFaq: false,
        faqQuestion: "Non in FAQ",
      }),
      card({
        id: "inactive",
        title: "Disattiva",
        isActive: false,
        showInFaq: true,
        faqQuestion: "Disattiva",
      }),
    ];

    const entries = buildFaqEntries(cards);
    expect(entries.map((item) => item.id)).toEqual(["new"]);
    expect(entries[0]?.question).toMatch(/liquidazione Compass/i);

    const searched = searchFaqEntries(entries, "filiale");
    expect(searched).toHaveLength(1);
    expect(searched[0]?.id).toBe("new");

    expect(searchFaqEntries(entries, "inesistente")).toHaveLength(0);
  });
});
