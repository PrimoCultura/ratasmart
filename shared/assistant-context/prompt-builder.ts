import type { PromptBuildInput, PromptBuildResult } from "./types.ts";
import { DEFAULT_PROMPT_MAX_CHARACTERS } from "./types.ts";

/**
 * Ordine di priorità:
 * 1 guardrail 2 comportamento 3 domanda 4 simulazione/strutturato
 * 5 knowledge 6 cronologia 7 dettagli secondari già nel strutturato
 */
export function buildVirtualMarcoPrompt(
  input: PromptBuildInput,
): PromptBuildResult {
  const maxTotal = input.maxTotalCharacters ?? DEFAULT_PROMPT_MAX_CHARACTERS;
  const warnings: string[] = [];

  const instructionsParts = [
    input.technicalGuardrails.trim(),
    "",
    "PROMPT DI COMPORTAMENTO",
    input.behaviorPrompt.trim(),
  ];

  const optionalBlocks: Array<{ label: string; content: string; priority: number }> =
    [
      { label: "structured", content: input.structuredContext.trim(), priority: 1 },
      { label: "knowledge", content: input.knowledgeContext.trim(), priority: 2 },
      { label: "history", content: input.historyText.trim(), priority: 3 },
    ].filter((block) => block.content.length > 0);

  const questionBlock = `DOMANDA CORRENTE DEL CLINIC MANAGER\n${input.currentQuestion.trim()}`;

  let instructions = instructionsParts.join("\n");
  const included: string[] = [];
  let total =
    instructions.length + questionBlock.length + 2;

  for (const block of optionalBlocks.sort((a, b) => a.priority - b.priority)) {
    const nextSize = block.content.length + 2;
    if (total + nextSize > maxTotal) {
      warnings.push(
        `Blocco “${block.label}” escluso per limite complessivo del contesto.`,
      );
      continue;
    }
    included.push(block.content);
    total += nextSize;
  }

  if (included.length > 0) {
    instructions = `${instructions}\n\n${included.join("\n\n")}`;
  }

  return {
    instructions,
    input: questionBlock,
    totalCharacters: instructions.length + questionBlock.length,
    warnings,
    truncated: warnings.length > 0,
  };
}
