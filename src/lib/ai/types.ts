export type AiRole = "user" | "assistant" | "system";

export type AiMessage = {
  id: string;
  role: AiRole;
  content: string;
  createdAt: number;
};

export type AiRequest = {
  messages: AiMessage[];
  /** ID simulazione aperta — sarà usato nelle fasi successive */
  simulationId?: string;
  userDisplayName?: string;
};

export type AiResponse = {
  message: AiMessage;
};

/**
 * Interfaccia provider AI.
 * Fase successiva: OpenAiProvider implementerà AiProvider.
 * I componenti chat dipendono solo da questa interfaccia.
 */
export interface AiProvider {
  sendMessage(input: AiRequest): Promise<AiResponse>;
}
