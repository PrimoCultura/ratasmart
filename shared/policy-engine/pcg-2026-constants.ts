/**
 * Costanti numeriche PCG 2026 condivise tra policy seed e FAQ.
 * Source of truth per età, anzianità e limiti studente/casalinga.
 */
export const PCG_2026_POLICY_CONSTANTS = {
  minimumAge: 18,
  seniorityMonths: 12,
  studentHousewifeMaxAmountEur: 2500,
  agosMaxAgeAtEnd: 82,
  compassMaxAgeAtApplicationExclusive: 75,
  compassMaxAgeAtEnd: 80,
  deutscheBankMaxAgeAtApplicationExclusive: 79,
  deutscheBankMaxAgeAtEnd: 80,
  /** Soglia KB ufficiale esenzione documento reddito (importo + spese finanziate). */
  incomeDocumentThresholdEur: 5000,
} as const;

export type Pcg2026PolicyConstants = typeof PCG_2026_POLICY_CONSTANTS;
