import type { AiProvider, AiRequest, AiResponse } from "./types";

/**
 * Provider mock per la chat V1.
 * Nessuna chiamata a OpenAI: risposta fissa locale.
 */
export class MockAiProvider implements AiProvider {
  async sendMessage(_input: AiRequest): Promise<AiResponse> {
    await new Promise((resolve) => setTimeout(resolve, 350));

    return {
      message: {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Virtual Marco sarà collegato alla base di conoscenza e alla simulazione aperta nella prossima fase.",
        createdAt: Date.now(),
      },
    };
  }
}

export const mockAiProvider = new MockAiProvider();
