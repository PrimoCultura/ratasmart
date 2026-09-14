import { normalizeText } from "../knowledge-engine/normalize.ts";
import type { EntityCatalogItem, MatchedEntities } from "./types.ts";

/**
 * Matching deterministico di finanziarie/prodotti/tabelle nella domanda.
 * Le etichette devono arrivare dai dati attivi Convex (non hardcodate).
 */
export function matchEntitiesFromQuestion(
  question: string,
  catalog: EntityCatalogItem[],
): MatchedEntities {
  const normalizedQuestion = normalizeText(question);
  const companyIds = new Set<string>();
  const productIds = new Set<string>();
  const tableIds = new Set<string>();
  const networks = new Set<"PCG" | "DES" | "Paoleschi">();
  const matchedLabels: string[] = [];

  const sorted = [...catalog].sort(
    (a, b) =>
      Math.max(...b.labels.map((label) => label.length), 0) -
      Math.max(...a.labels.map((label) => label.length), 0),
  );

  for (const item of sorted) {
    const hit = item.labels.some((label) => {
      const normalizedLabel = normalizeText(label);
      if (!normalizedLabel) return false;
      return (
        normalizedQuestion.includes(normalizedLabel) ||
        normalizedQuestion.split(" ").includes(normalizedLabel)
      );
    });
    if (!hit) continue;

    matchedLabels.push(item.labels[0] ?? item.id);
    if (item.kind === "company") {
      companyIds.add(item.id);
    } else if (item.kind === "product") {
      productIds.add(item.id);
      if (item.companyId) companyIds.add(item.companyId);
    } else if (item.kind === "table") {
      tableIds.add(item.id);
      if (item.productId) productIds.add(item.productId);
      if (item.companyId) companyIds.add(item.companyId);
      if (item.network) networks.add(item.network);
    }
  }

  if (normalizedQuestion.includes("pcg")) networks.add("PCG");
  if (normalizedQuestion.includes("des")) networks.add("DES");
  if (normalizedQuestion.includes("paoleschi")) networks.add("Paoleschi");

  return {
    companyIds: [...companyIds],
    productIds: [...productIds],
    tableIds: [...tableIds],
    networks: [...networks],
    matchedLabels: [...new Set(matchedLabels)],
  };
}
