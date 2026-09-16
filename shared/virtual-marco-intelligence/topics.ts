/**
 * Tassonomia topic Virtual Marco Intelligence (finita, leggibile).
 * Derivazione deterministica da KB category / intent / entity — senza LLM.
 */

export const VM_TOPICS = [
  "PATIENT_REQUIREMENTS",
  "DOCUMENTS",
  "GUARANTOR",
  "LIQUIDATION",
  "INSTALLMENTS_AND_DATES",
  "PAYMENTS_AND_INVOICING",
  "ZERO_INTEREST_AND_AUTHORIZATIONS",
  "EXISTING_FINANCING",
  "PAYMENT_METHODS",
  "PRODUCT_CONDITIONS",
  "COMPATIBILITY",
  "PROCEDURES",
  "OTHER",
] as const;

export type VmTopic = (typeof VM_TOPICS)[number];

export const VM_TOPIC_LABELS: Record<VmTopic, string> = {
  PATIENT_REQUIREMENTS: "Requisiti paziente",
  DOCUMENTS: "Documenti",
  GUARANTOR: "Garante",
  LIQUIDATION: "Liquidazione",
  INSTALLMENTS_AND_DATES: "Rate e scadenze",
  PAYMENTS_AND_INVOICING: "Pagamenti e fatturazione",
  ZERO_INTEREST_AND_AUTHORIZATIONS: "Tasso zero e autorizzazioni",
  EXISTING_FINANCING: "Finanziamenti esistenti",
  PAYMENT_METHODS: "Metodi di pagamento",
  PRODUCT_CONDITIONS: "Condizioni prodotto",
  COMPATIBILITY: "Compatibilità",
  PROCEDURES: "Procedure operative",
  OTHER: "Altro",
};

/** Mappa categorySnapshot KB → topic. */
export function topicFromKnowledgeCategory(category: string): VmTopic {
  switch (category) {
    case "documents":
      return "DOCUMENTS";
    case "guarantor":
      return "GUARANTOR";
    case "liquidation":
      return "LIQUIDATION";
    case "installment_date":
    case "extensions":
      return "INSTALLMENTS_AND_DATES";
    case "invoicing":
      return "PAYMENTS_AND_INVOICING";
    case "payment_methods":
      return "PAYMENT_METHODS";
    case "employment":
    case "residence_permit":
    case "income":
    case "invalidity_pension":
      return "PATIENT_REQUIREMENTS";
    case "rejected_practices":
      return "EXISTING_FINANCING";
    case "operational_alert":
      return "PROCEDURES";
    case "faq":
    case "other":
    default:
      return "OTHER";
  }
}

/** Mappa intent pre-screening → topic. */
export function topicFromIntent(intent: string): VmTopic {
  switch (intent) {
    case "documents":
      return "DOCUMENTS";
    case "guarantor":
      return "GUARANTOR";
    case "age":
    case "employment":
    case "residence_permit":
    case "pensioner":
      return "PATIENT_REQUIREMENTS";
    case "amount":
    case "duration":
      return "COMPATIBILITY";
    case "product":
      return "PRODUCT_CONDITIONS";
    case "company":
      return "PRODUCT_CONDITIONS";
    case "generic":
    default:
      return "OTHER";
  }
}

/**
 * Ordine preferenziale:
 * 1) categorie fonti KB (prima / più frequente)
 * 2) intent
 * 3) presenza company → PRODUCT_CONDITIONS
 * 4) OTHER
 */
export function deriveTopics(input: {
  sourceCategories: string[];
  intents: string[];
  hasCompanyMatch: boolean;
}): { primaryTopic: VmTopic; topicCodes: VmTopic[] } {
  const topics: VmTopic[] = [];
  const push = (topic: VmTopic) => {
    if (!topics.includes(topic)) topics.push(topic);
  };

  for (const category of input.sourceCategories) {
    push(topicFromKnowledgeCategory(category));
  }
  for (const intent of input.intents) {
    push(topicFromIntent(intent));
  }
  if (input.hasCompanyMatch && topics.length === 0) {
    push("PRODUCT_CONDITIONS");
  }
  if (topics.length === 0) {
    push("OTHER");
  }

  // Preferisci topic non-OTHER come primary se presente
  const primary =
    topics.find((topic) => topic !== "OTHER") ?? topics[0] ?? "OTHER";
  return { primaryTopic: primary, topicCodes: topics };
}
