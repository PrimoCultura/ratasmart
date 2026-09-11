import { normalizeText, tokenizeQuestion } from "./normalize.ts";
import {
  KNOWLEDGE_SCORE_WEIGHTS,
  type ChatPrivacyMode,
  type KnowledgeCardVisibility,
  type KnowledgeSelectionContext,
  type RuntimeKnowledgeCard,
} from "./types.ts";

/** Espansione leggera forme verbali/procedurali senza NLP. */
const TOKEN_ALIASES: Record<string, string[]> = {
  liquido: ["liquidazione", "liquidare", "liquido"],
  liquidare: ["liquidazione", "liquidare", "liquido"],
  liquidazione: ["liquidazione", "liquidare", "liquido"],
  erogare: ["erogazione", "erogare"],
  erogazione: ["erogazione", "erogare"],
  erogata: ["erogazione", "erogare"],
};

export function expandQuestionTokens(tokens: string[]): string[] {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const alias of TOKEN_ALIASES[token] ?? []) {
      expanded.add(alias);
    }
    if (token.startsWith("liquid")) {
      expanded.add("liquidazione");
      expanded.add("liquidare");
      expanded.add("liquido");
    }
    if (token.startsWith("erog")) {
      expanded.add("erogazione");
      expanded.add("erogare");
    }
  }
  return [...expanded];
}

export type ScoredKnowledgeCard = {
  card: RuntimeKnowledgeCard;
  score: number;
  matchReasons: string[];
  eligible: boolean;
  exclusionReason?: string;
};

/** Assenza del campo → internal_only. */
export function resolveCardVisibility(
  card: RuntimeKnowledgeCard,
): KnowledgeCardVisibility {
  return card.visibility ?? "internal_only";
}

export function isVisibilityCompatible(
  card: RuntimeKnowledgeCard,
  privacyMode: ChatPrivacyMode = "internal",
): boolean {
  if (privacyMode === "internal") {
    return true;
  }
  return resolveCardVisibility(card) === "patient_safe";
}

export function isCardValidAt(
  card: RuntimeKnowledgeCard,
  calculationDate: number,
): boolean {
  if (card.isActive === false) {
    return false;
  }
  if (card.validFrom !== undefined && calculationDate < card.validFrom) {
    return false;
  }
  if (card.validTo !== undefined && calculationDate > card.validTo) {
    return false;
  }
  return true;
}

export function isNetworkCompatible(
  cardNetwork: RuntimeKnowledgeCard["network"],
  contextNetwork: KnowledgeSelectionContext["network"],
): boolean {
  return cardNetwork === "BOTH" || cardNetwork === contextNetwork;
}

export function isScopeCompatible(
  card: RuntimeKnowledgeCard,
  context: KnowledgeSelectionContext,
): boolean {
  const companyIds = resolveScopeIds(context.companyIds, context.companyId);
  const productIds = resolveScopeIds(context.productIds, context.productId);
  const tableIds = resolveScopeIds(
    context.financialTableIds,
    context.financialTableId,
  );

  if (card.financialTableId) {
    if (tableIds.length === 0) return false;
    return tableIds.includes(card.financialTableId);
  }
  if (card.productId) {
    if (productIds.length === 0) return false;
    return productIds.includes(card.productId);
  }
  if (card.companyId) {
    if (companyIds.length === 0) return false;
    return companyIds.includes(card.companyId);
  }
  return true;
}

function resolveScopeIds(
  many: string[] | undefined,
  single: string | undefined,
): string[] {
  if (many && many.length > 0) {
    return [...new Set(many)];
  }
  if (single) {
    return [single];
  }
  return [];
}

/**
 * Esclude schede superseded da una versione attiva presente nel set candidato.
 * Preferire sempre isActive=false sulle superseded; questa è una rete di sicurezza.
 */
export function filterCurrentKnowledgeVersions(
  cards: RuntimeKnowledgeCard[],
): RuntimeKnowledgeCard[] {
  const active = cards.filter((card) => card.isActive !== false);
  const supersededByActive = new Set(
    active
      .map((card) => card.supersedesCardId)
      .filter((id): id is string => Boolean(id)),
  );
  return active.filter((card) => !supersededByActive.has(card.id));
}

export function scoreKnowledgeCard(
  card: RuntimeKnowledgeCard,
  context: KnowledgeSelectionContext,
): ScoredKnowledgeCard {
  if (card.isActive === false) {
    return {
      card,
      score: 0,
      matchReasons: [],
      eligible: false,
      exclusionReason: "Scheda non attiva",
    };
  }

  if (!isCardValidAt(card, context.calculationDate)) {
    return {
      card,
      score: 0,
      matchReasons: [],
      eligible: false,
      exclusionReason: "Fuori validità temporale",
    };
  }

  if (!isNetworkCompatible(card.network, context.network)) {
    return {
      card,
      score: 0,
      matchReasons: [],
      eligible: false,
      exclusionReason: "Rete non coerente",
    };
  }

  if (!isScopeCompatible(card, context)) {
    return {
      card,
      score: 0,
      matchReasons: [],
      eligible: false,
      exclusionReason: "Scope non coerente",
    };
  }

  const privacyMode = context.privacyMode ?? "internal";
  if (!isVisibilityCompatible(card, privacyMode)) {
    return {
      card,
      score: 0,
      matchReasons: [],
      eligible: false,
      exclusionReason: "Visibilità non compatibile con patient_safe",
    };
  }

  const visibility = resolveCardVisibility(card);
  const reasons: string[] = [
    `Rete compatibile (${card.network})`,
    `Visibilità ${visibility}`,
  ];
  let score = Math.max(0, card.priority);
  reasons.push(`Priorità ${card.priority}`);

  if (card.alwaysInclude) {
    score += KNOWLEDGE_SCORE_WEIGHTS.alwaysInclude;
    reasons.push("Sempre inclusa");
  }

  if (card.financialTableId) {
    score += KNOWLEDGE_SCORE_WEIGHTS.tableScope;
    reasons.push("Tabella specifica");
  } else if (card.productId) {
    score += KNOWLEDGE_SCORE_WEIGHTS.productScope;
    reasons.push("Prodotto specifico");
  } else if (card.companyId) {
    score += KNOWLEDGE_SCORE_WEIGHTS.companyScope;
    reasons.push("Finanziaria specifica");
  } else {
    reasons.push("Scheda generale");
  }

  const questionTokens = expandQuestionTokens(
    tokenizeQuestion(context.userQuestion),
  );
  const normalizedTitle = normalizeText(card.title);
  const titleTokens = new Set(normalizedTitle.split(" ").filter(Boolean));

  for (const token of questionTokens) {
    if (card.keywords.includes(token)) {
      score += KNOWLEDGE_SCORE_WEIGHTS.exactKeyword;
      reasons.push(`Keyword “${token}”`);
      continue;
    }

    const partial = card.keywords.find(
      (keyword) => keyword.includes(token) || token.includes(keyword),
    );
    if (partial) {
      score += KNOWLEDGE_SCORE_WEIGHTS.partialKeyword;
      reasons.push(`Keyword parziale “${partial}”`);
    }

    if (titleTokens.has(token) || normalizedTitle.includes(token)) {
      score += KNOWLEDGE_SCORE_WEIGHTS.titleTerm;
      reasons.push(`Termine nel titolo “${token}”`);
    }
  }

  return {
    card,
    score,
    matchReasons: [...new Set(reasons)],
    eligible: true,
  };
}
