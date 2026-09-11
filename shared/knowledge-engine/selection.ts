import { cardCharacterCount } from "./normalize.ts";
import {
  filterCurrentKnowledgeVersions,
  resolveCardVisibility,
  scoreKnowledgeCard,
} from "./scoring.ts";
import type {
  KnowledgeSelectionContext,
  KnowledgeSelectionOptions,
  KnowledgeSelectionResult,
  RuntimeKnowledgeCard,
  SelectedKnowledgeCard,
} from "./types.ts";
import { DEFAULT_MAX_CARDS, DEFAULT_MAX_CHARACTERS } from "./types.ts";

function toSelected(
  item: ReturnType<typeof scoreKnowledgeCard>,
): SelectedKnowledgeCard {
  return {
    id: item.card.id,
    title: item.card.title,
    content: item.card.content,
    category: item.card.category,
    isAlert: item.card.isAlert,
    alertLabel: item.card.alertLabel,
    visibility: resolveCardVisibility(item.card),
    score: item.score,
    matchReasons: item.matchReasons,
    version: item.card.version,
  };
}

function sortScored(
  a: ReturnType<typeof scoreKnowledgeCard>,
  b: ReturnType<typeof scoreKnowledgeCard>,
): number {
  if (a.card.alwaysInclude !== b.card.alwaysInclude) {
    return a.card.alwaysInclude ? -1 : 1;
  }
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  if (b.card.priority !== a.card.priority) {
    return b.card.priority - a.card.priority;
  }
  return a.card.title.localeCompare(b.card.title, "it");
}

/**
 * Seleziona schede pertinenti in modo deterministico (no embeddings).
 * Considera solo versioni attive già filtrate dal chiamante.
 */
export function selectRelevantKnowledgeCards(
  cards: RuntimeKnowledgeCard[],
  context: KnowledgeSelectionContext,
  options?: KnowledgeSelectionOptions,
): KnowledgeSelectionResult {
  const maxCards = options?.maxCards ?? DEFAULT_MAX_CARDS;
  const maxCharacters = options?.maxCharacters ?? DEFAULT_MAX_CHARACTERS;

  const currentCards = filterCurrentKnowledgeVersions(cards);
  const scored = currentCards.map((card) => scoreKnowledgeCard(card, context));
  const eligible = scored.filter((item) => item.eligible).sort(sortScored);

  const selected: SelectedKnowledgeCard[] = [];
  let totalCharacters = 0;
  let excludedByLimitCount = 0;
  const warnings: string[] = [];

  for (const item of eligible) {
    const size = cardCharacterCount(item.card);
    const wouldExceedCards = selected.length >= maxCards;
    const wouldExceedChars = totalCharacters + size > maxCharacters;

    if (wouldExceedCards || wouldExceedChars) {
      if (item.card.alwaysInclude && size > maxCharacters && selected.length === 0) {
        // Scheda alwaysInclude più grande del limite: includila sola.
        selected.push(toSelected(item));
        totalCharacters = size;
        warnings.push(
          `La scheda sempre inclusa “${item.card.title}” supera il limite caratteri ed è stata inclusa intera.`,
        );
        continue;
      }

      if (item.card.alwaysInclude && !wouldExceedCards && size <= maxCharacters - totalCharacters) {
        selected.push(toSelected(item));
        totalCharacters += size;
        continue;
      }

      excludedByLimitCount += 1;
      continue;
    }

    selected.push(toSelected(item));
    totalCharacters += size;
  }

  if (excludedByLimitCount > 0) {
    warnings.push(
      `${excludedByLimitCount} schede pertinenti escluse per limite di contesto.`,
    );
  }

  return {
    selectedCards: selected,
    excludedByLimitCount,
    totalCharacters,
    warnings,
  };
}

export function formatKnowledgeContext(
  selectedCards: SelectedKnowledgeCard[],
): string {
  if (selectedCards.length === 0) {
    return "BASE DI CONOSCENZA AZIENDALE\n\nNessuna scheda selezionata.";
  }

  const blocks = selectedCards.map((card, index) => {
    const alertLine = card.isAlert
      ? `\nAlert: ${card.alertLabel ?? "Avviso operativo"}`
      : "";
    return [
      `[SCHEDA ${index + 1}]`,
      `Titolo: ${card.title}`,
      `Categoria: ${card.category}${alertLine}`,
      `Contenuto: ${card.content}`,
    ].join("\n");
  });

  return `BASE DI CONOSCENZA AZIENDALE\n\n${blocks.join("\n\n")}`;
}
