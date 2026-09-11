"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  buildConversationTitleFromQuestion,
  buildVirtualMarcoPrompt,
} from "../shared/assistant-context/index";
import {
  AiProviderError,
  createServerAiProvider,
  sanitizeErrorMessage,
  toUserFacingError,
  USER_FACING_GENERIC_ERROR,
  validateAssistantModelConfig,
  VIRTUAL_MARCO_TECHNICAL_GUARDRAILS,
} from "./lib/ai/provider";

function providerEnv() {
  const env =
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {};
  return {
    AI_PROVIDER_MODE: env.AI_PROVIDER_MODE,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_BASE_URL: env.OPENAI_BASE_URL,
  };
}

type SendResult = {
  wasDuplicate: boolean;
  assistantMessageId?: Id<"assistantMessages">;
  status?: string;
  content?: string;
  outcome?: string;
  alerts?: string[];
  missingInformation?: string[];
  requiresVerification?: boolean;
  verificationTarget?: string;
  errorCode?: string;
  errorMessage?: string;
  userFacingError?: string;
  knowledgeCardsProvided?: number;
  usedPreScreeningContext?: boolean;
  preScreeningIntents?: string[];
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  provider?: string;
  contextWarnings?: string[];
};

/**
 * Invia un messaggio a Virtual Marco (OpenAI Responses API o mock esplicito).
 * Persistenza via internal mutation; stato conversazionale solo in Convex.
 * Il modelName arriva sempre da assistantConfigs attiva (mai hardcoded).
 */
export const sendVirtualMarcoMessage = action({
  args: {
    currentUserId: v.id("appUsers"),
    conversationId: v.id("assistantConversations"),
    message: v.string(),
    requestId: v.string(),
  },
  handler: async (ctx, args): Promise<SendResult> => {
    const content = args.message.trim();
    if (!content) {
      throw new Error("Il messaggio non può essere vuoto.");
    }
    if (!args.requestId.trim()) {
      throw new Error("requestId obbligatorio.");
    }

    const bundle = await ctx.runQuery(
      internal.assistantChatData.getVirtualMarcoTurnBundle,
      {
        currentUserId: args.currentUserId,
        conversationId: args.conversationId,
        userQuestion: content,
      },
    );

    const begin = await ctx.runMutation(
      internal.assistantChatPersistence.beginAssistantTurn,
      {
        conversationId: args.conversationId,
        ownerUserId: args.currentUserId,
        requestId: args.requestId,
        message: content,
        privacyMode: bundle.conversation.privacyMode,
        simulationId: bundle.conversation.simulationId,
        comparisonRunId:
          bundle.resolvedComparisonRunId ?? bundle.conversation.comparisonRunId,
        titleIfDefault: buildConversationTitleFromQuestion(content),
      },
    );

    if (begin.wasDuplicate) {
      return {
        wasDuplicate: true,
        assistantMessageId: begin.assistantMessageId,
        status: begin.assistantStatus,
        content: begin.assistantContent,
        outcome: begin.outcome,
        alerts: begin.alerts ?? [],
        missingInformation: begin.missingInformation ?? [],
        requiresVerification: begin.requiresVerification,
        verificationTarget: begin.verificationTarget,
        errorCode: begin.errorCode,
        errorMessage: begin.errorMessage,
        userFacingError:
          begin.assistantStatus === "failed"
            ? USER_FACING_GENERIC_ERROR
            : undefined,
      };
    }

    const assistantMessageId = begin.assistantMessageId;
    if (!assistantMessageId) {
      throw new Error("Impossibile creare il messaggio assistant.");
    }

    const auditFields = {
      usedPreScreeningContext: bundle.usedPreScreeningContext === true,
      preScreeningIntents: bundle.intents as string[],
      matchedCompanyIds: bundle.matchedCompanyIds as Id<"financialCompanies">[],
    };

    try {
      validateAssistantModelConfig(bundle.config);

      const prompt = buildVirtualMarcoPrompt({
        technicalGuardrails: VIRTUAL_MARCO_TECHNICAL_GUARDRAILS,
        behaviorPrompt: bundle.config.behaviorPrompt,
        knowledgeContext: bundle.knowledgeContext,
        structuredContext: bundle.structuredContext,
        historyText: bundle.historyText,
        currentQuestion: content,
      });

      const provider = createServerAiProvider(providerEnv());
      const result = await provider.generateResponse({
        model: bundle.config.modelName,
        instructions: prompt.instructions,
        input: prompt.input,
        temperature: bundle.config.temperature,
        maxOutputTokens: bundle.config.maxOutputTokens,
      });

      await ctx.runMutation(
        internal.assistantChatPersistence.completeAssistantTurn,
        {
          assistantMessageId,
          conversationId: args.conversationId,
          content: result.output.answer,
          outcome: result.output.outcome,
          requiresVerification: result.output.requiresVerification,
          verificationTarget: result.output.verificationTarget,
          alerts: result.output.alerts,
          missingInformation: result.output.missingInformation,
          assistantConfigId: bundle.config._id,
          assistantConfigVersion: bundle.config.version,
          provider: result.provider,
          model: result.model,
          providerResponseId: result.providerResponseId,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          totalTokens: result.totalTokens,
          sources: bundle.knowledgeSources,
          ...auditFields,
        },
      );

      return {
        wasDuplicate: false,
        assistantMessageId,
        status: "completed",
        content: result.output.answer,
        outcome: result.output.outcome,
        alerts: result.output.alerts,
        missingInformation: result.output.missingInformation,
        requiresVerification: result.output.requiresVerification,
        verificationTarget: result.output.verificationTarget,
        knowledgeCardsProvided: bundle.knowledgeSources.length,
        usedPreScreeningContext: auditFields.usedPreScreeningContext,
        preScreeningIntents: auditFields.preScreeningIntents,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        model: result.model,
        provider: result.provider,
        contextWarnings: [...bundle.contextWarnings, ...prompt.warnings],
      };
    } catch (error) {
      if (error instanceof AiProviderError && error.code === "invalid_output") {
        try {
          const provider = createServerAiProvider(providerEnv());
          const prompt = buildVirtualMarcoPrompt({
            technicalGuardrails: VIRTUAL_MARCO_TECHNICAL_GUARDRAILS,
            behaviorPrompt: bundle.config.behaviorPrompt,
            knowledgeContext: bundle.knowledgeContext,
            structuredContext: bundle.structuredContext,
            historyText: bundle.historyText,
            currentQuestion: content,
          });
          const result = await provider.generateResponse({
            model: bundle.config.modelName,
            instructions: `${prompt.instructions}\n\nRispondi esclusivamente con JSON valido secondo lo schema richiesto.`,
            input: prompt.input,
            temperature: bundle.config.temperature,
            maxOutputTokens: bundle.config.maxOutputTokens,
          });
          await ctx.runMutation(
            internal.assistantChatPersistence.completeAssistantTurn,
            {
              assistantMessageId,
              conversationId: args.conversationId,
              content: result.output.answer,
              outcome: result.output.outcome,
              requiresVerification: result.output.requiresVerification,
              verificationTarget: result.output.verificationTarget,
              alerts: result.output.alerts,
              missingInformation: result.output.missingInformation,
              assistantConfigId: bundle.config._id,
              assistantConfigVersion: bundle.config.version,
              provider: result.provider,
              model: result.model,
              providerResponseId: result.providerResponseId,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              totalTokens: result.totalTokens,
              sources: bundle.knowledgeSources,
              ...auditFields,
            },
          );
          return {
            wasDuplicate: false,
            assistantMessageId,
            status: "completed",
            content: result.output.answer,
            outcome: result.output.outcome,
            alerts: result.output.alerts,
            missingInformation: result.output.missingInformation,
            requiresVerification: result.output.requiresVerification,
            verificationTarget: result.output.verificationTarget,
            knowledgeCardsProvided: bundle.knowledgeSources.length,
            usedPreScreeningContext: auditFields.usedPreScreeningContext,
            preScreeningIntents: auditFields.preScreeningIntents,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            totalTokens: result.totalTokens,
            model: result.model,
            provider: result.provider,
          };
        } catch (retryError) {
          const details = toUserFacingError(retryError);
          await ctx.runMutation(
            internal.assistantChatPersistence.failAssistantTurn,
            {
              assistantMessageId,
              conversationId: args.conversationId,
              errorCode: details.code,
              errorMessage: details.message,
              assistantConfigId: bundle.config._id,
              assistantConfigVersion: bundle.config.version,
            },
          );
          return {
            wasDuplicate: false,
            assistantMessageId,
            status: "failed",
            content: USER_FACING_GENERIC_ERROR,
            userFacingError: USER_FACING_GENERIC_ERROR,
            errorCode: details.code,
          };
        }
      }

      const details = toUserFacingError(error);
      await ctx.runMutation(
        internal.assistantChatPersistence.failAssistantTurn,
        {
          assistantMessageId,
          conversationId: args.conversationId,
          errorCode: details.code,
          errorMessage: sanitizeErrorMessage(details.message),
          assistantConfigId: bundle.config._id,
          assistantConfigVersion: bundle.config.version,
          model: bundle.config.modelName,
          provider: bundle.config.modelProvider,
        },
      );
      return {
        wasDuplicate: false,
        assistantMessageId,
        status: "failed",
        content: USER_FACING_GENERIC_ERROR,
        userFacingError: USER_FACING_GENERIC_ERROR,
        errorCode: details.code,
      };
    }
  },
});

type TestConnectionResult =
  | {
      ok: true;
      model: string;
      provider: string;
      latencyMs: number;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      outcome: string;
    }
  | {
      ok: false;
      model: string;
      provider: string;
      latencyMs: number;
      errorCode: string;
      errorMessage: string;
    };

/**
 * Test connessione admin: richiesta minima senza dati paziente/aziendali.
 * Comporta utilizzo API se mode=openai.
 */
export const testVirtualMarcoConnection = action({
  args: {
    actorUserId: v.id("appUsers"),
  },
  handler: async (ctx, args): Promise<TestConnectionResult> => {
    const config = await ctx.runQuery(
      internal.assistantChatAdmin.getActiveConfigForTest,
      { actorUserId: args.actorUserId },
    );

    validateAssistantModelConfig(config);
    const provider = createServerAiProvider(providerEnv());
    const started = Date.now();
    try {
      const result = await provider.generateResponse({
        model: config.modelName,
        instructions: `${VIRTUAL_MARCO_TECHNICAL_GUARDRAILS}\n\nRispondi in italiano con output strutturato. Questa è solo una verifica tecnica di connessione.`,
        input:
          "DOMANDA CORRENTE DEL CLINIC MANAGER\nConferma solo che la connessione funziona, senza inventare policy.",
        temperature: config.temperature,
        maxOutputTokens: Math.min(config.maxOutputTokens, 400),
      });
      return {
        ok: true,
        model: result.model,
        provider: result.provider,
        latencyMs: result.latencyMs || Date.now() - started,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        outcome: result.output.outcome,
      };
    } catch (error) {
      const details = toUserFacingError(error);
      return {
        ok: false,
        model: config.modelName,
        provider: config.modelProvider,
        latencyMs: Date.now() - started,
        errorCode: details.code,
        errorMessage: details.message,
      };
    }
  },
});
