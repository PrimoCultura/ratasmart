import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  VirtualMarcoOutputSchema,
  type VirtualMarcoOutput,
} from "./outputSchema";
import { AiProviderError, sanitizeErrorMessage } from "./errors";
import type {
  AiProviderRequest,
  AiProviderResponse,
  ServerAiProvider,
} from "./types";

function extractOutputText(response: {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}): string {
  if (response.output_text && response.output_text.trim()) {
    return response.output_text;
  }
  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

function isUnsupportedTemperatureError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error);
  return (
    message.includes("temperature") &&
    (message.includes("unsupported") ||
      message.includes("not supported") ||
      message.includes("unknown parameter"))
  );
}

/**
 * Adapter OpenAI Responses API.
 * Il modello arriva sempre da `input.model` (assistantConfigs.modelName).
 */
export class OpenAiResponsesProvider implements ServerAiProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new OpenAI({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });
  }

  async generateResponse(
    input: AiProviderRequest,
  ): Promise<AiProviderResponse> {
    const started = Date.now();
    let usedTemperature = input.temperature !== undefined;
    let response: Awaited<ReturnType<OpenAI["responses"]["create"]>>;

    const buildParams = (includeTemperature: boolean) => ({
      model: input.model,
      instructions: input.instructions,
      input: input.input,
      max_output_tokens: input.maxOutputTokens,
      store: false as const,
      ...(includeTemperature && input.temperature !== undefined
        ? { temperature: input.temperature }
        : {}),
      text: {
        format: zodTextFormat(VirtualMarcoOutputSchema, "virtual_marco_output"),
      },
    });

    try {
      try {
        response = await this.client.responses.create(
          buildParams(usedTemperature),
        );
      } catch (error) {
        if (usedTemperature && isUnsupportedTemperatureError(error)) {
          usedTemperature = false;
          response = await this.client.responses.create(buildParams(false));
        } else {
          throw error;
        }
      }
    } catch (error) {
      const message = sanitizeErrorMessage(
        error instanceof Error ? error.message : "Errore OpenAI",
      );
      const lower = message.toLowerCase();
      if (lower.includes("api key") || lower.includes("authentication")) {
        throw new AiProviderError("missing_api_key", message);
      }
      if (lower.includes("quota") || lower.includes("rate limit")) {
        throw new AiProviderError("quota_exceeded", message, true);
      }
      if (lower.includes("timeout")) {
        throw new AiProviderError("timeout", message, true);
      }
      if (lower.includes("model")) {
        throw new AiProviderError("model_unavailable", message);
      }
      throw new AiProviderError("provider_error", message, true);
    }

    const rawText = extractOutputText(response);
    if (!rawText) {
      throw new AiProviderError(
        "empty_response",
        "Il provider ha restituito una risposta vuota.",
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      throw new AiProviderError(
        "invalid_output",
        "La risposta del modello non è JSON valido.",
      );
    }

    const validated = VirtualMarcoOutputSchema.safeParse(parsedJson);
    if (!validated.success) {
      throw new AiProviderError(
        "invalid_output",
        "La risposta del modello non rispetta lo schema strutturato.",
      );
    }

    const usage = response.usage;
    return {
      output: validated.data satisfies VirtualMarcoOutput,
      provider: "openai",
      model: input.model,
      providerResponseId: response.id,
      inputTokens: usage?.input_tokens,
      outputTokens: usage?.output_tokens,
      totalTokens: usage?.total_tokens,
      latencyMs: Date.now() - started,
      rawText,
    };
  }
}
