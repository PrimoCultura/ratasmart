import { filterCurrentKnowledgeVersions } from "./scoring.ts";
import type { RuntimeKnowledgeCard } from "./types.ts";

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
        a.order - b.order ||
        a.category.localeCompare(b.category, "it") ||
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
