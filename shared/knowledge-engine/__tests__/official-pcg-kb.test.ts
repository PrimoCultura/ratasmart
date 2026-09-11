import { describe, expect, it } from "vitest";
import {
  formatKnowledgeContext,
  PCG_KNOWLEDGE_CARDS_2026,
  selectRelevantKnowledgeCards,
  type RuntimeKnowledgeCard,
} from "../index.ts";

const now = Date.UTC(2026, 8, 11);

const COMPANY = {
  agos: "company-agos",
  compass: "company-compass",
  db: "company-db",
} as const;

const PRODUCT_AGOS_PASS = "product-agos-pass";

function officialRuntimeCards(): RuntimeKnowledgeCard[] {
  return PCG_KNOWLEDGE_CARDS_2026.map((seed) => ({
    id: `official-${seed.seedKey}`,
    title: seed.title,
    content: seed.content,
    category: seed.category,
    network: seed.network,
    companyId:
      seed.companyShortName === "Agos"
        ? COMPANY.agos
        : seed.companyShortName === "Compass"
          ? COMPANY.compass
          : seed.companyShortName === "Deutsche Bank"
            ? COMPANY.db
            : undefined,
    productId: seed.productName === "Agos Pass" ? PRODUCT_AGOS_PASS : undefined,
    keywords: seed.keywords.map((item) => item.toLowerCase()),
    priority: seed.priority,
    alwaysInclude: seed.alwaysInclude ?? false,
    isAlert: seed.isAlert ?? false,
    alertLabel: seed.alertLabel,
    visibility: seed.visibility,
    isActive: true,
    version: 1,
  }));
}

function demoRuntimeCards(): RuntimeKnowledgeCard[] {
  return [
    {
      id: "demo-liquidazione",
      title: "DEMO TECNICA – Gestione liquidazione",
      content:
        "DEMO TECNICA – NON USARE COME POLICY UFFICIALE. Procedura dimostrativa.",
      category: "liquidation",
      network: "PCG",
      keywords: ["liquidazione", "agos", "fattura"],
      priority: 100,
      alwaysInclude: false,
      isAlert: false,
      visibility: "internal_only",
      isActive: false,
      version: 1,
    },
    {
      id: "demo-garante",
      title: "DEMO TECNICA – Regola garante",
      content:
        "DEMO TECNICA – NON USARE COME POLICY UFFICIALE. Garante dimostrativo.",
      category: "guarantor",
      network: "PCG",
      keywords: ["garante", "cugino"],
      priority: 100,
      alwaysInclude: false,
      isAlert: false,
      visibility: "internal_only",
      isActive: false,
      version: 1,
    },
    {
      id: "demo-data-rata",
      title: "DEMO TECNICA – Alert data rata Agos",
      content:
        "DEMO TECNICA – NON USARE COME POLICY UFFICIALE. ATTENZIONE data rata.",
      category: "operational_alert",
      network: "PCG",
      companyId: COMPANY.agos,
      keywords: ["agos", "data rata", "addebito"],
      priority: 100,
      alwaysInclude: false,
      isAlert: true,
      visibility: "internal_only",
      isActive: false,
      version: 1,
    },
  ];
}

function select(
  question: string,
  options?: {
    companyId?: string;
    productId?: string;
    privacyMode?: "internal" | "patient_safe";
  },
) {
  return selectRelevantKnowledgeCards(
    [...officialRuntimeCards(), ...demoRuntimeCards()],
    {
      network: "PCG",
      companyId: options?.companyId,
      productId: options?.productId,
      userQuestion: question,
      calculationDate: now,
      privacyMode: options?.privacyMode ?? "internal",
    },
    { maxCards: 12, maxCharacters: 24_000 },
  );
}

describe("KB ufficiale PCG 2026", () => {
  it("espone 17 card ufficiali attive con network PCG", () => {
    expect(PCG_KNOWLEDGE_CARDS_2026).toHaveLength(17);
    expect(
      PCG_KNOWLEDGE_CARDS_2026.every(
        (card) => card.network === "PCG" && card.visibility === "internal_only",
      ),
    ).toBe(true);
  });

  it("non recupera card DEMO TECNICA disattivate", () => {
    const result = select("liquidazione Agos fattura garante data rata", {
      companyId: COMPANY.agos,
    });
    expect(
      result.selectedCards.every((card) => !card.title.includes("DEMO TECNICA")),
    ).toBe(true);
    expect(result.selectedCards.map((card) => card.id)).not.toContain(
      "demo-liquidazione",
    );
  });

  it("recupera Agos data rata", () => {
    const result = select("posso cambiare la data rata Agos?", {
      companyId: COMPANY.agos,
    });
    const text = formatKnowledgeContext(result.selectedCards);
    expect(text).toMatch(/Agos – data di addebito rata/);
    expect(text).toMatch(/NON MODIFICARE LA DATA DI SCADENZA RATA/i);
  });

  it("recupera Agos liquidazione e fattura 48h", () => {
    const result = select("entro quando devo caricare la fattura Agos?", {
      companyId: COMPANY.agos,
    });
    const text = formatKnowledgeContext(result.selectedCards);
    expect(text).toMatch(/Agos – liquidazione e fattura 48h/);
    expect(text).toMatch(/48 ore/i);
    expect(text).toMatch(/PrimoUp/i);
    expect(text).toMatch(/blocco delle successive liquidazioni/i);
  });

  it("recupera garante soggetti ammessi per cugino", () => {
    const result = select("posso mettere mio cugino come garante?");
    const text = formatKnowledgeContext(result.selectedCards);
    expect(text).toMatch(/Garante – soggetti ammessi/);
    expect(text).toMatch(/prima cerchia familiare/i);
    expect(text).toMatch(/cugini/i);
    expect(text).toMatch(/genitori/i);
    expect(text).toMatch(/figli/i);
  });

  it("recupera pensione di invalidità", () => {
    const result = select("ho una pensione di invalidità");
    const text = formatKnowledgeContext(result.selectedCards);
    expect(text).toMatch(/Pensione di invalidità/);
    expect(text).toMatch(/AGOS/i);
    expect(text).toMatch(/DEUTSCHE BANK/i);
    expect(text).toMatch(/COMPASS/i);
  });

  it("recupera metodi di pagamento / PostePay", () => {
    const result = select("posso usare una Postepay?");
    const text = formatKnowledgeContext(result.selectedCards);
    expect(text).toMatch(/Metodi di pagamento e carte ammesse/);
    expect(text).toMatch(/PostePay Evolution/i);
    expect(text).toMatch(/carte ricaricabili/i);
  });

  it("recupera ampliamento finanziamento Agos", () => {
    const result = select("devo ampliare un finanziamento Agos", {
      companyId: COMPANY.agos,
    });
    const text = formatKnowledgeContext(result.selectedCards);
    expect(text).toMatch(/Ampliamento di un finanziamento esistente/);
    expect(text).toMatch(/finanziamento parallelo/i);
  });

  it("recupera pratiche Agos respinte dopo le 17", () => {
    const result = select("Agos mi ha respinto la pratica dopo le 17", {
      companyId: COMPANY.agos,
    });
    const text = formatKnowledgeContext(result.selectedCards);
    expect(text).toMatch(/pratiche respinte dopo le ore 17/i);
    expect(text).toMatch(/non risultano più gestibili/i);
  });

  it("non duplica TAN/TAEG/ranking delle tabelle nelle card ufficiali", () => {
    for (const card of PCG_KNOWLEDGE_CARDS_2026) {
      expect(card.content).not.toMatch(/\bTAN\b/);
      expect(card.content).not.toMatch(/\bTAEG\b/);
      expect(card.content).not.toMatch(/ranking/i);
      expect(card.content).not.toMatch(/commissione di istruttoria/i);
    }
  });

  it("in patient_safe non espone card internal_only", () => {
    const result = select("posso cambiare la data rata Agos?", {
      companyId: COMPANY.agos,
      privacyMode: "patient_safe",
    });
    expect(result.selectedCards).toHaveLength(0);
  });
});
