import { normalizeText, tokenizeQuestion } from "./normalize.ts";
import {
  KNOWLEDGE_SCORE_WEIGHTS,
  type ChatPrivacyMode,
  type KnowledgeCardVisibility,
  type KnowledgeSelectionContext,
  type RuntimeKnowledgeCard,
} from "./types.ts";

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
  if (card.financialTableId) {
    return card.financialTableId === context.financialTableId;
  }
  if (card.productId) {
    return card.productId === context.productId;
  }
  if (card.companyId) {
    return card.companyId === context.companyId;
  }
  return true;
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

  const questionTokens = tokenizeQuestion(context.userQuestion);
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
