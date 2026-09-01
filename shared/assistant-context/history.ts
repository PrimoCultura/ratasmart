import type { HistoryMessage } from "./types.ts";
import {
  DEFAULT_HISTORY_MAX_CHARACTERS,
  DEFAULT_HISTORY_MAX_MESSAGES,
} from "./types.ts";

export function selectHistoryForPrompt(
  messages: HistoryMessage[],
  options?: { maxMessages?: number; maxCharacters?: number },
): { messages: HistoryMessage[]; warnings: string[] } {
  const maxMessages = options?.maxMessages ?? DEFAULT_HISTORY_MAX_MESSAGES;
  const maxCharacters =
    options?.maxCharacters ?? DEFAULT_HISTORY_MAX_CHARACTERS;
  const warnings: string[] = [];

  const eligible = messages.filter(
    (message) =>
      message.status === "completed" &&
      message.content.trim().length > 0 &&
      (message.role === "user" || message.role === "assistant"),
  );

  const selected: HistoryMessage[] = [];
  let total = 0;

  for (let index = eligible.length - 1; index >= 0; index -= 1) {
    const message = eligible[index];
    if (!message) continue;
    const size = message.content.length;
    if (selected.length >= maxMessages || total + size > maxCharacters) {
      warnings.push("Cronologia ridotta per limite messaggi/caratteri.");
      break;
    }
    selected.unshift(message);
    total += size;
  }

  return { messages: selected, warnings: [...new Set(warnings)] };
}

export function formatHistoryForPrompt(messages: HistoryMessage[]): string {
  if (messages.length === 0) {
    return "";
  }
  const lines = ["CRONOLOGIA RECENTE"];
  for (const message of messages) {
    const role = message.role === "user" ? "CM" : "Virtual Marco";
    lines.push(`${role}: ${message.content}`);
  }
  return lines.join("\n");
}

export function buildConversationTitleFromQuestion(question: string): string {
  const cleaned = question.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "Nuova conversazione";
  }
  if (cleaned.length <= 60) {
    return cleaned;
  }
  return `${cleaned.slice(0, 57).trimEnd()}...`;
}
