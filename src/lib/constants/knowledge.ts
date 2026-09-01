export const KNOWLEDGE_CATEGORIES = [
  "documents",
  "liquidation",
  "invoicing",
  "guarantor",
  "income",
  "invalidity_pension",
  "employment",
  "residence_permit",
  "payment_methods",
  "installment_date",
  "extensions",
  "rejected_practices",
  "operational_alert",
  "faq",
  "other",
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  documents: "Documenti",
  liquidation: "Liquidazione",
  invoicing: "Fatturazione",
  guarantor: "Garante",
  income: "Reddito",
  invalidity_pension: "Pensione di invalidità",
  employment: "Lavoro",
  residence_permit: "Permesso di soggiorno",
  payment_methods: "Metodi di pagamento",
  installment_date: "Data addebito / rata",
  extensions: "Ampliamenti",
  rejected_practices: "Pratiche respinte",
  operational_alert: "Alert operativo",
  faq: "FAQ",
  other: "Altro",
};

export const KNOWLEDGE_NETWORKS = ["PCG", "DES", "BOTH"] as const;
export type KnowledgeNetwork = (typeof KNOWLEDGE_NETWORKS)[number];

export const KNOWLEDGE_NETWORK_LABELS: Record<KnowledgeNetwork, string> = {
  PCG: "PCG",
  DES: "DES",
  BOTH: "Entrambe",
};
