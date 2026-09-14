export type KnowledgeNetwork = "PCG" | "DES" | "Paoleschi" | "BOTH";

export type KnowledgeCategory =
  | "documents"
  | "liquidation"
  | "invoicing"
  | "guarantor"
  | "income"
  | "invalidity_pension"
  | "employment"
  | "residence_permit"
  | "payment_methods"
  | "installment_date"
  | "extensions"
  | "rejected_practices"
  | "operational_alert"
  | "faq"
  | "other";

export type KnowledgeCardVisibility = "patient_safe" | "internal_only";

export type ChatPrivacyMode = "patient_safe" | "internal";

export type KnowledgeSelectionContext = {
  network: "PCG" | "DES" | "Paoleschi";
  /** @deprecated Preferire companyIds per query multi-finanziaria. */
  companyId?: string;
  /** Finanziarie matchate nella domanda (tutte, non solo la prima). */
  companyIds?: string[];
  /** @deprecated Preferire productIds. */
  productId?: string;
  productIds?: string[];
  /** @deprecated Preferire financialTableIds. */
  financialTableId?: string;
  financialTableIds?: string[];
  userQuestion?: string;
  calculationDate: number;
  /** Default: internal (admin preview / selezione completa). */
  privacyMode?: ChatPrivacyMode;
};

export type RuntimeKnowledgeCard = {
  id: string;
  title: string;
  content: string;
  category: string;
  network: KnowledgeNetwork;
  companyId?: string;
  productId?: string;
  financialTableId?: string;
  keywords: string[];
  priority: number;
  alwaysInclude: boolean;
  isAlert: boolean;
  alertLabel?: string;
  /**
   * Assenza → internal_only (compatibilità schede esistenti).
   */
  visibility?: KnowledgeCardVisibility;
  isActive?: boolean;
  validFrom?: number;
  validTo?: number;
  version?: number;
  supersedesCardId?: string;
};

export type SelectedKnowledgeCard = {
  id: string;
  title: string;
  content: string;
  category: string;
  isAlert: boolean;
  alertLabel?: string;
  visibility: KnowledgeCardVisibility;
  score: number;
  matchReasons: string[];
  version?: number;
};

export type KnowledgeSelectionResult = {
  selectedCards: SelectedKnowledgeCard[];
  excludedByLimitCount: number;
  totalCharacters: number;
  warnings: string[];
};

export type KnowledgeSelectionOptions = {
  maxCards?: number;
  maxCharacters?: number;
};

/** Pesi documentati per lo scoring deterministico. */
export const KNOWLEDGE_SCORE_WEIGHTS = {
  alwaysInclude: 1000,
  tableScope: 300,
  productScope: 200,
  companyScope: 100,
  exactKeyword: 40,
  partialKeyword: 15,
  titleTerm: 30,
} as const;

export const DEFAULT_MAX_CARDS = 12;
export const DEFAULT_MAX_CHARACTERS = 18_000;
