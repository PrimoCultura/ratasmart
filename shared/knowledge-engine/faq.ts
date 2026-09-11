import { filterCurrentKnowledgeVersions } from "./scoring.ts";
import type { RuntimeKnowledgeCard } from "./types.ts";

export const FAQ_CATEGORY_ORDER = [
  "Requisiti paziente",
  "Documenti",
  "Garanti",
  "Agos",
  "Compass",
  "Deutsche Bank",
  "Rate e scadenze",
  "Pagamenti e fatturazione",
  "Tasso zero e autorizzazioni",
] as const;

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  keywords: string[];
  title: string;
  version: number;
};

export type FaqCardFields = {
  showInFaq?: boolean;
  faqQuestion?: string;
  faqCategory?: string;
  faqOrder?: number;
};

export type FaqKnowledgeCard = RuntimeKnowledgeCard & FaqCardFields;

export function isFaqEligibleCard(card: FaqKnowledgeCard): boolean {
  return card.isActive === true && card.showInFaq === true;
}

function categoryRank(category: string): number {
  const index = FAQ_CATEGORY_ORDER.indexOf(
    category as (typeof FAQ_CATEGORY_ORDER)[number],
  );
  return index === -1 ? FAQ_CATEGORY_ORDER.length + 1 : index;
}

export function listFaqCategories(entries: FaqEntry[]): string[] {
  const present = new Set(entries.map((entry) => entry.category));
  const ordered = FAQ_CATEGORY_ORDER.filter((category) => present.has(category));
  const extras = [...present]
    .filter((category) => !FAQ_CATEGORY_ORDER.includes(category as (typeof FAQ_CATEGORY_ORDER)[number]))
    .sort((a, b) => a.localeCompare(b, "it"));
  return [...ordered, ...extras];
}

export function buildFaqEntries(cards: FaqKnowledgeCard[]): FaqEntry[] {
  const current = filterCurrentKnowledgeVersions(cards) as FaqKnowledgeCard[];
  return current
    .filter(isFaqEligibleCard)
    .map((card) => ({
      id: card.id,
      question: (card.faqQuestion?.trim() || card.title).trim(),
      answer: card.content,
      category: (card.faqCategory?.trim() || "Altro").trim(),
      order: card.faqOrder ?? card.priority ?? 100,
      keywords: card.keywords ?? [],
      title: card.title,
      version: card.version ?? 1,
    }))
    .sort(
      (a, b) =>
        categoryRank(a.category) - categoryRank(b.category) ||
        a.order - b.order ||
        a.question.localeCompare(b.question, "it"),
    );
}

export function searchFaqEntries(
  entries: FaqEntry[],
  query: string,
): FaqEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) => {
    const haystack = [
      entry.question,
      entry.title,
      entry.answer,
      entry.category,
      ...entry.keywords,
    ]
      .join("\n")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function filterFaqByCategory(
  entries: FaqEntry[],
  category: string | "all",
): FaqEntry[] {
  if (category === "all") return entries;
  return entries.filter((entry) => entry.category === category);
}
