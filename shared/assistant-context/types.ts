export type ChatPrivacyMode = "patient_safe" | "internal";

export type AssistantMessageRole = "user" | "assistant";

export type HistoryMessage = {
  role: AssistantMessageRole;
  content: string;
  status: "pending" | "completed" | "failed";
};

export type AnonymizedPatientProfile = {
  age?: number;
  employmentType?: string;
  temporaryContractExpiry?: number;
  isNonEuCitizen?: boolean;
  residencePermitExpiry?: number;
};

export type AnonymizedSolutionSummary = {
  companyShortName: string;
  companyName: string;
  productName: string;
  productCode?: string;
  tableCode: string;
  tableDisplayName: string;
  resultGroup: "compatible" | "verification_required" | "not_compatible";
  reasons: string[];
  verificationReasons: string[];
  technicalExclusionReasons: string[];
  regularTotalInstallmentAmount?: number;
  taegPercent?: number;
  customerTanPercent?: number;
  durationMonths?: number;
  financedAmount?: number;
  distanceFromTargetInstallment?: number;
  // Internal-only fields (filtered by privacy)
  priorityScore?: number;
  priorityLabel?: string;
  priorityVisibleReason?: string;
  isCompanyPriority?: boolean;
  internalCostAmount?: number;
  netAmountPaidToCompany?: number;
  internalMessages?: Array<{ title: string; message: string; messageType: string }>;
  requiresManagerAuthorizationNotice?: boolean;
};

export type AnonymizedSimulationContextInput = {
  network: "PCG" | "DES" | "Paoleschi";
  requestedAmount?: number;
  targetInstallment?: number;
  selectedDurationMonths?: number;
  selectedFirstInstallmentDelayDays?: number;
  patient: AnonymizedPatientProfile;
  solutions: AnonymizedSolutionSummary[];
  proposedSolution?: AnonymizedSolutionSummary | null;
  privacyMode: ChatPrivacyMode;
};

export type EntityCatalogItem = {
  kind: "company" | "product" | "table";
  id: string;
  labels: string[];
  companyId?: string;
  productId?: string;
  network?: "PCG" | "DES" | "Paoleschi";
};

export type MatchedEntities = {
  companyIds: string[];
  productIds: string[];
  tableIds: string[];
  networks: Array<"PCG" | "DES" | "Paoleschi">;
  matchedLabels: string[];
};

export type PromptBuildInput = {
  technicalGuardrails: string;
  behaviorPrompt: string;
  knowledgeContext: string;
  structuredContext: string;
  historyText: string;
  currentQuestion: string;
  maxTotalCharacters?: number;
};

export type PromptBuildResult = {
  instructions: string;
  input: string;
  totalCharacters: number;
  warnings: string[];
  truncated: boolean;
};

export const DEFAULT_HISTORY_MAX_MESSAGES = 12;
export const DEFAULT_HISTORY_MAX_CHARACTERS = 12_000;
export const DEFAULT_PROMPT_MAX_CHARACTERS = 45_000;
