import { normalizeText } from "../knowledge-engine/normalize.ts";

export const PRE_SCREENING_INTENTS = [
  "age",
  "amount",
  "duration",
  "employment",
  "residence_permit",
  "pensioner",
  "guarantor",
  "documents",
  "product",
  "company",
  "generic",
] as const;

export type PreScreeningIntent = (typeof PRE_SCREENING_INTENTS)[number];

type IntentPattern = {
  intent: Exclude<PreScreeningIntent, "generic">;
  patterns: RegExp[];
};

/**
 * Pattern linguistici italiani per intent di pre-screening.
 * Nessun numero di policy hardcodato: solo riconoscimento tema domanda.
 */
const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "age",
    patterns: [
      /\betal\b/,
      /\banni\b/,
      /\banzian/,
      /\blimite\s+et/,
      /\bmassimo\s+anni\b/,
      /\bminimo\s+anni\b/,
      /\b\d{1,3}\s*anni\b/,
      /\bsenior\b/,
    ],
  },
  {
    intent: "amount",
    patterns: [
      /\bimporto\b/,
      /\bfinanziare\b/,
      /\bfinanziamento\b/,
      /\bmassimo\s+importo\b/,
      /\bminimo\s+importo\b/,
      /\b\d{1,3}([.,]\d{3})+\s*€?\b/,
      /\b\d+\s*(euro|€)\b/,
      /\b25[\s.]?000\b/,
      /\b20[\s.]?000\b/,
    ],
  },
  {
    intent: "duration",
    patterns: [
      /\bmesi\b/,
      /\brate\b/,
      /\bdurata\b/,
      /\b\d+\s*rate\b/,
      /\b\d+\s*mesi\b/,
      /\bmassimo\s+rate\b/,
      /\bmassime\s+rate\b/,
    ],
  },
  {
    intent: "employment",
    patterns: [
      /\btempo\s+determinato\b/,
      /\bdeterminato\b/,
      /\btempo\s+indeterminato\b/,
      /\bindeterminato\b/,
      /\bstudente\b/,
      /\bcasalinga\b/,
      /\bautonomo\b/,
      /\bdipendente\b/,
      /\bcontratto\b/,
      /\banzianit/,
      /\boccupazione\b/,
      /\blavorativ/,
    ],
  },
  {
    intent: "residence_permit",
    patterns: [
      /\bextracomunitari/,
      /\bstranier/,
      /\bpermesso\s+di\s+soggiorno\b/,
      /\bpermesso\b/,
      /\bricevuta\b/,
      /\brinnovo\s+permesso\b/,
      /\bcittadinanza\b/,
      /\bnon\s+ue\b/,
      /\bnon\s+eu\b/,
    ],
  },
  {
    intent: "pensioner",
    patterns: [
      /\bpensionat/,
      /\bpensione\b/,
      /\binvalidit/,
      /\bpensione\s+di\s+invalidit/,
    ],
  },
  {
    intent: "guarantor",
    patterns: [
      /\bgarante\b/,
      /\bgaranzia\b/,
      /\bgenitore\b/,
      /\bfiglio\b/,
      /\bfiglia\b/,
    ],
  },
  {
    intent: "documents",
    patterns: [
      /\bdocumenti\b/,
      /\bdocumento\b/,
      /\bbusta\s+paga\b/,
      /\bcarta\s+d['’]?identit/,
      /\breddito\b/,
      /\bdocumentazione\b/,
    ],
  },
  {
    intent: "product",
    patterns: [
      /\bprodotto\b/,
      /\btabella\b/,
      /\bcodice\b/,
      /\bcategoria\b/,
      /\btasso\s+zero\b/,
      /\bagevolat/,
    ],
  },
  {
    intent: "company",
    patterns: [
      /\bfinanziaria\b/,
      /\bfinanziarie\b/,
      /\bsociet[aà]\s+finanziaria\b/,
      /\bquale\s+finanziaria\b/,
      /\bquali\s+finanziarie\b/,
    ],
  },
];

/**
 * Riconoscimento deterministico multi-intent (nessuna chiamata LLM).
 */
export function detectPreScreeningIntents(
  question: string,
): PreScreeningIntent[] {
  const normalized = normalizeText(question);
  if (!normalized.trim()) {
    return ["generic"];
  }

  // Raw lower-case mantiene punteggiatura importi (€, punti migliaia).
  const rawLower = question.toLowerCase();
  const haystacks = [normalized, rawLower];

  const detected = new Set<Exclude<PreScreeningIntent, "generic">>();
  for (const entry of INTENT_PATTERNS) {
    if (
      entry.patterns.some((pattern) =>
        haystacks.some((haystack) => pattern.test(haystack)),
      )
    ) {
      detected.add(entry.intent);
    }
  }

  if (detected.size === 0) {
    return ["generic"];
  }
  return [...detected];
}
