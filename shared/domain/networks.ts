/** Reti commerciali supportate da simulazioni / tabelle finanziarie. */
export const NETWORK_CODES = ["PCG", "DES", "Paoleschi"] as const;
export type NetworkCode = (typeof NETWORK_CODES)[number];

/** Reti ammesse sulle knowledge card (BOTH = tutte). */
export const KNOWLEDGE_NETWORK_CODES = [
  "PCG",
  "DES",
  "Paoleschi",
  "BOTH",
] as const;
export type KnowledgeNetworkCode = (typeof KNOWLEDGE_NETWORK_CODES)[number];
