import { describe, expect, it } from "vitest";
import {
  assertNoPatientIdentifiers,
  buildAnonymizedSimulationContext,
  buildConversationTitleFromQuestion,
  buildEntityCatalogFromActiveData,
  buildVirtualMarcoPrompt,
  formatHistoryForPrompt,
  matchEntitiesFromQuestion,
  selectHistoryForPrompt,
} from "../index.ts";
import { selectRelevantKnowledgeCards } from "../../knowledge-engine/index.ts";
import { VirtualMarcoOutputSchema } from "../../../convex/lib/ai/outputSchema.ts";
import { MockServerProvider } from "../../../convex/lib/ai/mockServerProvider.ts";
import { AiProviderError } from "../../../convex/lib/ai/errors.ts";
import {
  createServerAiProvider,
  validateAssistantModelConfig,
} from "../../../convex/lib/ai/providerFactory.ts";

const GUARDRAILS = "GUARDRAIL TECNICO NON MODIFICABILE";

describe("privacy simulazione", () => {
  const base = {
    network: "PCG" as const,
    requestedAmount: 4500,
    targetInstallment: 200,
    selectedDurationMonths: 24,
    patient: {
      age: 76,
      employmentType: "pensioner",
      isNonEuCitizen: false,
    },
    solutions: [
      {
        companyShortName: "Agos",
        companyName: "Agos",
        productName: "Agos Pass",
        tableCode: "AGOS_PASS_DEMO",
        tableDisplayName: "Agos Pass Demo",
        resultGroup: "compatible" as const,
        reasons: [],
        verificationReasons: [],
        technicalExclusionReasons: [],
        regularTotalInstallmentAmount: 198,
        internalCostAmount: 120,
        netAmountPaidToCompany: 4300,
        isCompanyPriority: true,
        priorityScore: 90,
        priorityLabel: "Priorità demo",
        priorityVisibleReason: "Incentivo interno",
        internalMessages: [
          { title: "Bonus", message: "Provvigione X", messageType: "positive" },
        ],
      },
    ],
    proposedSolution: null,
  };

  it("esclude identificativi paziente/clinica dal testo", () => {
    const text = buildAnonymizedSimulationContext({
      ...base,
      privacyMode: "patient_safe",
    });
    expect(assertNoPatientIdentifiers(text)).toEqual([]);
    expect(text).not.toMatch(/patientFirstName|patientLastName|clinicName/i);
    expect(text).not.toContain("Mario");
  });

  it("patient_safe esclude costi, priorità e messaggi interni", () => {
    const text = buildAnonymizedSimulationContext({
      ...base,
      privacyMode: "patient_safe",
    });
    expect(text).not.toContain("Costo aziendale");
    expect(text).not.toContain("Netto liquidato");
    expect(text).not.toContain("Priorità aziendale");
    expect(text).not.toContain("Messaggio interno");
    expect(text).not.toContain("Provvigione");
  });

  it("internal include informazioni autorizzate", () => {
    const text = buildAnonymizedSimulationContext({
      ...base,
      privacyMode: "internal",
    });
    expect(text).toContain("Costo aziendale");
    expect(text).toContain("Priorità aziendale");
    expect(text).toContain("Messaggio interno");
  });
});

describe("knowledge visibility", () => {
  const cards = [
    {
      id: "safe",
      title: "Safe",
      content: "ok",
      category: "faq",
      network: "BOTH" as const,
      keywords: [],
      priority: 50,
      alwaysInclude: false,
      isAlert: false,
      visibility: "patient_safe" as const,
      isActive: true,
    },
    {
      id: "internal",
      title: "Internal",
      content: "secret",
      category: "faq",
      network: "BOTH" as const,
      keywords: [],
      priority: 80,
      alwaysInclude: false,
      isAlert: false,
      visibility: "internal_only" as const,
      isActive: true,
    },
    {
      id: "legacy",
      title: "Legacy",
      content: "old",
      category: "faq",
      network: "BOTH" as const,
      keywords: [],
      priority: 70,
      alwaysInclude: false,
      isAlert: false,
      isActive: true,
    },
  ];

  it("patient_safe seleziona solo schede sicure", () => {
    const result = selectRelevantKnowledgeCards(cards, {
      network: "PCG",
      calculationDate: Date.now(),
      privacyMode: "patient_safe",
    });
    expect(result.selectedCards.map((item) => item.id)).toEqual(["safe"]);
  });

  it("internal include schede interne e legacy (default internal_only)", () => {
    const result = selectRelevantKnowledgeCards(cards, {
      network: "PCG",
      calculationDate: Date.now(),
      privacyMode: "internal",
    });
    expect(result.selectedCards.map((item) => item.id).sort()).toEqual([
      "internal",
      "legacy",
      "safe",
    ]);
  });
});

describe("contesto e cronologia", () => {
  it("riconosce entità dal catalogo dati", () => {
    const catalog = buildEntityCatalogFromActiveData({
      companies: [{ id: "c1", name: "Agos", shortName: "Agos" }],
      products: [
        { id: "p1", companyId: "c1", name: "Agos Pass", code: "PASS" },
      ],
      tables: [
        {
          id: "t1",
          companyId: "c1",
          productId: "p1",
          tableCode: "81K",
          displayName: "Tabella 81K",
          network: "PCG",
        },
      ],
    });
    const matched = matchEntitiesFromQuestion("Come funziona Agos Pass 81K?", catalog);
    expect(matched.companyIds).toContain("c1");
    expect(matched.productIds).toContain("p1");
    expect(matched.tableIds).toContain("t1");
  });

  it("limita la cronologia senza troncare messaggi", () => {
    const messages = Array.from({ length: 20 }, (_, index) => ({
      role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Messaggio ${index} `.repeat(10),
      status: "completed" as const,
    }));
    const selected = selectHistoryForPrompt(messages, {
      maxMessages: 4,
      maxCharacters: 12_000,
    });
    expect(selected.messages.length).toBeLessThanOrEqual(4);
    expect(selected.warnings.length).toBeGreaterThan(0);
    expect(formatHistoryForPrompt(selected.messages)).toContain("CRONOLOGIA");
  });

  it("titolo deterministico max 60", () => {
    expect(buildConversationTitleFromQuestion("Ciao")).toBe("Ciao");
    expect(
      buildConversationTitleFromQuestion("x".repeat(80)).length,
    ).toBeLessThanOrEqual(60);
  });

  it("riduce il prompt se supera il limite complessivo", () => {
    const result = buildVirtualMarcoPrompt({
      technicalGuardrails: GUARDRAILS,
      behaviorPrompt: "Comportamento",
      knowledgeContext: "K".repeat(1000),
      structuredContext: "S".repeat(1000),
      historyText: "H".repeat(1000),
      currentQuestion: "Domanda",
      maxTotalCharacters: 800,
    });
    expect(result.truncated).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.instructions).toContain(GUARDRAILS);
    expect(result.input).toContain("Domanda");
  });
});

describe("output e provider mock", () => {
  it("valida JSON strutturato", () => {
    const parsed = VirtualMarcoOutputSchema.parse({
      outcome: "answered",
      answer: "Ok",
      requiresVerification: false,
      verificationTarget: "none",
      alerts: [],
      missingInformation: [],
    });
    expect(parsed.answer).toBe("Ok");
  });

  it("rigetta JSON non valido", () => {
    expect(() =>
      VirtualMarcoOutputSchema.parse({ outcome: "answered", answer: "" }),
    ).toThrow();
  });

  it("mock provider risponde e conta le chiamate", async () => {
    const callCountRef = { count: 0 };
    const provider = new MockServerProvider({ callCountRef });
    const first = await provider.generateResponse({
      model: "gpt-5.6-luna",
      instructions: "x",
      input: "y",
      maxOutputTokens: 100,
    });
    expect(first.output.outcome).toBe("answered");
    expect(callCountRef.count).toBe(1);
  });

  it("mock può fallire in modo controllato", async () => {
    const provider = new MockServerProvider({
      failWith: new AiProviderError("provider_error", "boom"),
    });
    await expect(
      provider.generateResponse({
        model: "gpt-5.6-luna",
        instructions: "x",
        input: "y",
        maxOutputTokens: 100,
      }),
    ).rejects.toBeInstanceOf(AiProviderError);
  });

  it("manca chiave con mode openai → errore senza fallback mock", () => {
    expect(() =>
      createServerAiProvider({
        AI_PROVIDER_MODE: "openai",
        OPENAI_API_KEY: "",
      }),
    ).toThrow(/OPENAI_API_KEY/);
  });

  it("modello da-configurare bloccato", () => {
    expect(() =>
      validateAssistantModelConfig({
        modelProvider: "openai",
        modelName: "da-configurare",
        temperature: 0.2,
        maxOutputTokens: 1200,
      }),
    ).toThrow(/da-configurare/);
  });
});
