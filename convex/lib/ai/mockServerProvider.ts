import {
  VirtualMarcoOutputSchema,
  type VirtualMarcoOutput,
} from "./outputSchema";
import { AiProviderError } from "./errors";
import type {
  AiProviderRequest,
  AiProviderResponse,
  ServerAiProvider,
} from "./types";

export type MockServerProviderOptions = {
  response?: VirtualMarcoOutput;
  failWith?: AiProviderError;
  latencyMs?: number;
  callCountRef?: { count: number };
};

/**
 * Provider mock per test e sviluppo esplicito (AI_PROVIDER_MODE=mock).
 * Non si attiva automaticamente se manca la chiave OpenAI.
 */
export class MockServerProvider implements ServerAiProvider {
  private readonly options: MockServerProviderOptions;

  constructor(options: MockServerProviderOptions = {}) {
    this.options = options;
  }

  async generateResponse(
    input: AiProviderRequest,
  ): Promise<AiProviderResponse> {
    if (this.options.callCountRef) {
      this.options.callCountRef.count += 1;
    }
    if (this.options.failWith) {
      throw this.options.failWith;
    }

    const latencyMs = this.options.latencyMs ?? 5;
    const raw =
      this.options.response ??
      ({
        outcome: "answered",
        answer:
          "Risposta mock di Virtual Marco basata sulle fonti aziendali disponibili.",
        requiresVerification: false,
        verificationTarget: "none",
        alerts: [],
        missingInformation: [],
      } satisfies VirtualMarcoOutput);

    const parsed = VirtualMarcoOutputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AiProviderError(
        "invalid_output",
        "Output mock non valido rispetto allo schema.",
      );
    }

    return {
      output: parsed.data,
      provider: "mock",
      model: input.model,
      providerResponseId: `mock_${Date.now()}`,
      inputTokens: Math.ceil(
        (input.instructions.length + input.input.length) / 4,
      ),
      outputTokens: Math.ceil(parsed.data.answer.length / 4),
      totalTokens: Math.ceil(
        (input.instructions.length +
          input.input.length +
          parsed.data.answer.length) /
          4,
      ),
      latencyMs,
      rawText: JSON.stringify(parsed.data),
    };
  }
}
