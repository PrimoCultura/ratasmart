const STOP_WORDS = new Set([
  "a",
  "ad",
  "al",
  "alla",
  "allo",
  "che",
  "chi",
  "ci",
  "con",
  "da",
  "dal",
  "dalla",
  "di",
  "e",
  "ed",
  "il",
  "in",
  "la",
  "le",
  "lo",
  "ma",
  "nei",
  "nel",
  "nella",
  "o",
  "per",
  "se",
  "si",
  "su",
  "sul",
  "sulla",
  "un",
  "una",
  "uno",
]);

/**
 * Normalizza testo per matching keyword:
 * minuscole, senza accenti/punteggiatura, spazi collassati.
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeQuestion(question: string | undefined): string[] {
  if (!question || !question.trim()) {
    return [];
  }
  const tokens = normalizeText(question)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  return [...new Set(tokens)];
}

/**
 * Normalizza keywords: minuscole, trim, no duplicati, no vuote.
 */
export function normalizeKeywords(keywords: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of keywords) {
    const normalized = normalizeText(raw);
    if (!normalized || STOP_WORDS.has(normalized)) {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function cardCharacterCount(card: {
  title: string;
  content: string;
  category: string;
}): number {
  return (
    card.title.length +
    card.content.length +
    card.category.length +
    64 // overhead markup contesto
  );
}
