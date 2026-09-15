/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assistantChat from "../assistantChat.js";
import type * as assistantChatAdmin from "../assistantChatAdmin.js";
import type * as assistantChatData from "../assistantChatData.js";
import type * as assistantChatPersistence from "../assistantChatPersistence.js";
import type * as assistantConfigs from "../assistantConfigs.js";
import type * as assistantConversations from "../assistantConversations.js";
import type * as commercialPriorities from "../commercialPriorities.js";
import type * as comparison from "../comparison.js";
import type * as comparisonData from "../comparisonData.js";
import type * as comparisonPersistence from "../comparisonPersistence.js";
import type * as comparisonQueries from "../comparisonQueries.js";
import type * as financialCompanies from "../financialCompanies.js";
import type * as financialProducts from "../financialProducts.js";
import type * as financialTables from "../financialTables.js";
import type * as internalMessages from "../internalMessages.js";
import type * as knowledgeCards from "../knowledgeCards.js";
import type * as lib_agosPcg2026Data from "../lib/agosPcg2026Data.js";
import type * as lib_ai_errors from "../lib/ai/errors.js";
import type * as lib_ai_mockServerProvider from "../lib/ai/mockServerProvider.js";
import type * as lib_ai_openaiResponsesProvider from "../lib/ai/openaiResponsesProvider.js";
import type * as lib_ai_outputSchema from "../lib/ai/outputSchema.js";
import type * as lib_ai_provider from "../lib/ai/provider.js";
import type * as lib_ai_providerFactory from "../lib/ai/providerFactory.js";
import type * as lib_ai_types from "../lib/ai/types.js";
import type * as lib_authHelpers from "../lib/authHelpers.js";
import type * as lib_comparisonSnapshotMapper from "../lib/comparisonSnapshotMapper.js";
import type * as lib_desPaoleschi2026Data from "../lib/desPaoleschi2026Data.js";
import type * as lib_desPaoleschiSeedRunner from "../lib/desPaoleschiSeedRunner.js";
import type * as lib_financialValidation from "../lib/financialValidation.js";
import type * as lib_patientSnapshotValidator from "../lib/patientSnapshotValidator.js";
import type * as lib_pcg2026SeedData from "../lib/pcg2026SeedData.js";
import type * as lib_pcgFinancingPolicies2026Data from "../lib/pcgFinancingPolicies2026Data.js";
import type * as lib_pcgPolicySeedRunner from "../lib/pcgPolicySeedRunner.js";
import type * as lib_pcgSeedRunner from "../lib/pcgSeedRunner.js";
import type * as lib_policyMapper from "../lib/policyMapper.js";
import type * as policies from "../policies.js";
import type * as seed from "../seed.js";
import type * as simulations from "../simulations.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assistantChat: typeof assistantChat;
  assistantChatAdmin: typeof assistantChatAdmin;
  assistantChatData: typeof assistantChatData;
  assistantChatPersistence: typeof assistantChatPersistence;
  assistantConfigs: typeof assistantConfigs;
  assistantConversations: typeof assistantConversations;
  commercialPriorities: typeof commercialPriorities;
  comparison: typeof comparison;
  comparisonData: typeof comparisonData;
  comparisonPersistence: typeof comparisonPersistence;
  comparisonQueries: typeof comparisonQueries;
  financialCompanies: typeof financialCompanies;
  financialProducts: typeof financialProducts;
  financialTables: typeof financialTables;
  internalMessages: typeof internalMessages;
  knowledgeCards: typeof knowledgeCards;
  "lib/agosPcg2026Data": typeof lib_agosPcg2026Data;
  "lib/ai/errors": typeof lib_ai_errors;
  "lib/ai/mockServerProvider": typeof lib_ai_mockServerProvider;
  "lib/ai/openaiResponsesProvider": typeof lib_ai_openaiResponsesProvider;
  "lib/ai/outputSchema": typeof lib_ai_outputSchema;
  "lib/ai/provider": typeof lib_ai_provider;
  "lib/ai/providerFactory": typeof lib_ai_providerFactory;
  "lib/ai/types": typeof lib_ai_types;
  "lib/authHelpers": typeof lib_authHelpers;
  "lib/comparisonSnapshotMapper": typeof lib_comparisonSnapshotMapper;
  "lib/desPaoleschi2026Data": typeof lib_desPaoleschi2026Data;
  "lib/desPaoleschiSeedRunner": typeof lib_desPaoleschiSeedRunner;
  "lib/financialValidation": typeof lib_financialValidation;
  "lib/patientSnapshotValidator": typeof lib_patientSnapshotValidator;
  "lib/pcg2026SeedData": typeof lib_pcg2026SeedData;
  "lib/pcgFinancingPolicies2026Data": typeof lib_pcgFinancingPolicies2026Data;
  "lib/pcgPolicySeedRunner": typeof lib_pcgPolicySeedRunner;
  "lib/pcgSeedRunner": typeof lib_pcgSeedRunner;
  "lib/policyMapper": typeof lib_policyMapper;
  policies: typeof policies;
  seed: typeof seed;
  simulations: typeof simulations;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
