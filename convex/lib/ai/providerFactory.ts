import { AiProviderError } from "./errors";
import { MockServerProvider } from "./mockServerProvider";
import { OpenAiResponsesProvider } from "./openaiResponsesProvider";
import type { AiProviderMode, ServerAiProvider } from "./types";

export type ProviderFactoryEnv = {
  AI_PROVIDER_MODE?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
};

export function resolveProviderMode(env: ProviderFactoryEnv): AiProviderMode {
  const raw = (env.AI_PROVIDER_MODE ?? "").trim().toLowerCase();
  if (raw === "mock") return "mock";
  if (raw === "openai" || raw === "") return "openai";
  throw new AiProviderError(
    "unsupported_provider",
    `AI_PROVIDER_MODE non supportato: ${raw}. Usa "openai" o "mock".`,
  );
}

/**
 * Crea il provider server-side.
 * Se mode=openai e manca la chiave → errore chiaro (nessun fallback silenzioso al mock).
 * `env` va passato dal caller `"use node"` (process.env).
 */
export function createServerAiProvider(
  env: ProviderFactoryEnv,
  mock?: MockServerProvider,
): ServerAiProvider {
  const mode = resolveProviderMode(env);
  if (mode === "mock") {
    return mock ?? new MockServerProvider();
  }

  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiProviderError(
      "missing_api_key",
      "OPENAI_API_KEY mancante. Imposta la variabile ambiente Convex e AI_PROVIDER_MODE=openai.",
    );
  }

  return new OpenAiResponsesProvider(apiKey, env.OPENAI_BASE_URL?.trim());
}

export function validateAssistantModelConfig(config: {
  modelProvider: string;
  modelName: string;
  temperature: number;
  maxOutputTokens: number;
}): void {
  const provider = config.modelProvider.trim().toLowerCase();
  if (provider !== "openai" && provider !== "mock") {
    throw new AiProviderError(
      "unsupported_provider",
      `Provider modello non supportato: ${config.modelProvider}. Usa "openai" o "mock".`,
    );
  }
  const modelName = config.modelName.trim();
  if (!modelName) {
    throw new AiProviderError(
      "model_not_configured",
      "Il nome modello della configurazione attiva è vuoto.",
    );
  }
  if (modelName === "da-configurare") {
    throw new AiProviderError(
      "model_not_configured",
      'Il modello è ancora "da-configurare". Aggiorna la configurazione attiva.',
    );
  }
  if (config.temperature < 0 || config.temperature > 2) {
    throw new AiProviderError(
      "invalid_config",
      "Temperatura fuori intervallo (0–2).",
    );
  }
  if (config.maxOutputTokens <= 0) {
    throw new AiProviderError(
      "invalid_config",
      "maxOutputTokens non valido.",
    );
  }
}
