import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const network = v.union(
  v.literal("PCG"),
  v.literal("DES"),
  v.literal("Paoleschi"),
);

const productCategory = v.union(
  v.literal("standard"),
  v.literal("zero_interest"),
  v.literal("subsidized"),
  v.literal("small_amount"),
  v.literal("special"),
  v.literal("bnpl"),
);

const openingFeeType = v.union(
  v.literal("none"),
  v.literal("fixed"),
  v.literal("percentage"),
);

const installmentFeeType = v.union(
  v.literal("none"),
  v.literal("fixed"),
  v.literal("percentage_of_requested_amount"),
);

const activeCommissionBase = v.union(v.literal("requested_amount"));

const internalCostBase = v.union(
  v.literal("requested_amount"),
  v.literal("financed_amount"),
);

const employmentType = v.union(
  v.literal("permanent_employee"),
  v.literal("temporary_employee"),
  v.literal("pensioner"),
  v.literal("self_employed"),
  v.literal("unemployed"),
  v.literal("student"),
  v.literal("housewife"),
  v.literal("other"),
);

const policyRuleType = v.union(
  v.literal("minimum_age"),
  v.literal("maximum_age_at_application"),
  v.literal("maximum_age_at_end"),
  v.literal("employment_type_allowed"),
  v.literal("temporary_contract_expiry"),
  v.literal("pensioner_allowed"),
  v.literal("non_eu_allowed"),
  v.literal("residence_permit_expiry"),
  v.literal("renewal_receipt_allowed"),
  v.literal("minimum_employment_seniority_months"),
  v.literal("maximum_amount_for_employment_types"),
  v.literal("guarantor_required_for_employment_types"),
  v.literal("minimum_amount"),
  v.literal("maximum_amount"),
  v.literal("minimum_duration"),
  v.literal("maximum_duration"),
  v.literal("precise_age_at_application_range"),
  v.literal("custom"),
);

const policyOperator = v.union(
  v.literal("equals"),
  v.literal("not_equals"),
  v.literal("greater_than"),
  v.literal("greater_than_or_equal"),
  v.literal("less_than"),
  v.literal("less_than_or_equal"),
  v.literal("in"),
  v.literal("not_in"),
  v.literal("date_after_financing_end"),
  v.literal("date_after_application"),
  v.literal("custom"),
);

const messageType = v.union(
  v.literal("positive"),
  v.literal("warning"),
  v.literal("information"),
);

const iconType = v.union(
  v.literal("plus"),
  v.literal("exclamation"),
  v.literal("info"),
);

const resultGroup = v.union(
  v.literal("compatible"),
  v.literal("verification_required"),
  v.literal("not_compatible"),
);

const durationTerm = v.object({
  durationMonths: v.number(),
  minimumAmount: v.number(),
  maximumAmount: v.number(),
  customerTanPercent: v.optional(v.number()),
  internalCostPercent: v.optional(v.number()),
});

const durationTermSnapshot = v.object({
  durationMonths: v.number(),
  minimumAmount: v.number(),
  maximumAmount: v.number(),
  customerTanPercent: v.number(),
  internalCostPercent: v.optional(v.number()),
});

const comparisonStatus = v.union(
  v.literal("not_started"),
  v.literal("calculated"),
  v.literal("solution_selected"),
);

const comparisonSource = v.union(
  v.literal("initial_calculation"),
  v.literal("manual_recalculation"),
);

const knowledgeNetwork = v.union(
  v.literal("PCG"),
  v.literal("DES"),
  v.literal("Paoleschi"),
  v.literal("BOTH"),
);

const knowledgeCategory = v.union(
  v.literal("documents"),
  v.literal("liquidation"),
  v.literal("invoicing"),
  v.literal("guarantor"),
  v.literal("income"),
  v.literal("invalidity_pension"),
  v.literal("employment"),
  v.literal("residence_permit"),
  v.literal("payment_methods"),
  v.literal("installment_date"),
  v.literal("extensions"),
  v.literal("rejected_practices"),
  v.literal("operational_alert"),
  v.literal("faq"),
  v.literal("other"),
);

/**
 * Schema RataSmart — Fase 1–4A.
 * Predisposto per Auth0 tramite `externalAuthId`.
 *
 * FASE 3C: snapshot immutabili dei confronti.
 * FASE 4A: assistantConfigs + knowledgeCards.
 * FASE 4B: chat Virtual Marco (OpenAI Responses API, store:false).
 * Il piano di ammortamento non è persistito: si rigenera dagli input.
 */
export default defineSchema({
  appUsers: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    displayName: v.string(),
    clinicName: v.optional(v.string()),
    role: v.union(v.literal("cm"), v.literal("admin")),
    isDemo: v.boolean(),
    externalAuthId: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_external_auth_id", ["externalAuthId"])
    .index("by_role", ["role"])
    .index("by_is_active", ["isActive"]),

  simulations: defineTable({
    ownerUserId: v.id("appUsers"),
    patientFirstName: v.string(),
    patientLastName: v.string(),
    network,
    status: v.union(v.literal("draft"), v.literal("proposed")),
    requestedAmount: v.optional(v.number()),
    targetInstallment: v.optional(v.number()),
    selectedSolutionLabel: v.optional(v.string()),
    patientAge: v.optional(v.number()),
    /** Fonte primaria età (ISO `YYYY-MM-DD`). Required sulle nuove simulazioni. */
    patientBirthDate: v.optional(v.string()),
    employmentType: v.optional(employmentType),
    temporaryContractExpiry: v.optional(v.number()),
    isNonEuCitizen: v.optional(v.boolean()),
    residencePermitExpiry: v.optional(v.number()),
    hasResidencePermitRenewalReceiptOnly: v.optional(v.boolean()),
    employmentStartDate: v.optional(v.string()),
    employmentSeniorityMonths: v.optional(v.number()),
    hasGuarantor: v.optional(v.boolean()),
    patientRequestsZeroInterest: v.optional(v.boolean()),
    requestedDurationMonths: v.optional(v.number()),
    preferredFirstInstallmentDelayDays: v.optional(v.number()),
    lastComparisonAt: v.optional(v.number()),
    // FASE 3C
    latestComparisonRunId: v.optional(v.id("simulationComparisonRuns")),
    proposedSolutionId: v.optional(v.id("simulationComparisonSolutions")),
    proposedComparisonRunId: v.optional(v.id("simulationComparisonRuns")),
    comparisonStatus: v.optional(comparisonStatus),
    proposedAt: v.optional(v.number()),
    lastInputUpdatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerUserId"])
    .index("by_owner_updated_at", ["ownerUserId", "updatedAt"]),

  simulationComparisonRuns: defineTable({
    simulationId: v.id("simulations"),
    ownerUserId: v.id("appUsers"),
    requestId: v.string(),
    runNumber: v.number(),
    calculationDate: v.number(),
    createdAt: v.number(),
    network,
    selectedDurationMonths: v.number(),
    selectedFirstInstallmentDelayDays: v.number(),
    requestedAmount: v.number(),
    targetInstallment: v.optional(v.number()),
    patientSnapshot: v.object({
      firstName: v.string(),
      lastName: v.string(),
      age: v.number(),
      birthDate: v.optional(v.string()),
      ageAtReferenceDate: v.optional(v.number()),
      employmentType,
      temporaryContractExpiry: v.optional(v.number()),
      isNonEuCitizen: v.boolean(),
      residencePermitExpiry: v.optional(v.number()),
      hasResidencePermitRenewalReceiptOnly: v.optional(v.boolean()),
      employmentStartDate: v.optional(v.string()),
      employmentSeniorityMonths: v.optional(v.number()),
      seniorityReferenceDate: v.optional(v.number()),
      hasGuarantor: v.optional(v.boolean()),
      patientRequestsZeroInterest: v.optional(v.boolean()),
    }),
    compatibleSolutionsCount: v.number(),
    verificationRequiredSolutionsCount: v.number(),
    incompatibleSolutionsCount: v.number(),
    nearestTargetSolutionRuntimeId: v.optional(v.string()),
    disclaimer: v.string(),
    fiscalWarning: v.string(),
    warnings: v.array(v.string()),
    engineVersion: v.string(),
    policyEngineVersion: v.string(),
    source: comparisonSource,
    /**
     * Diagnostica deterministica alternative (solo run nuovi).
     * Assenza = run storico senza diagnostica persistita.
     */
    diagnosticsSnapshot: v.optional(v.any()),
    alternativeDiagnosticsVersion: v.optional(v.string()),
    /**
     * Analisi tasso zero vs sconto equivalente (solo se richiesta).
     * Assenza = run senza analisi o flag disattivo.
     */
    zeroInterestAlternativeSnapshot: v.optional(v.any()),
    zeroInterestAlternativeVersion: v.optional(v.string()),
  })
    .index("by_simulation", ["simulationId"])
    .index("by_simulation_created_at", ["simulationId", "createdAt"])
    .index("by_owner", ["ownerUserId"])
    .index("by_owner_created_at", ["ownerUserId", "createdAt"])
    .index("by_request_id", ["requestId"]),

  simulationComparisonSolutions: defineTable({
    comparisonRunId: v.id("simulationComparisonRuns"),
    simulationId: v.id("simulations"),
    ownerUserId: v.id("appUsers"),
    runtimeSolutionId: v.string(),
    resultGroup,
    rankPosition: v.number(),
    companySnapshot: v.object({
      companyId: v.string(),
      name: v.string(),
      shortName: v.string(),
    }),
    productSnapshot: v.object({
      productId: v.string(),
      name: v.string(),
      code: v.optional(v.string()),
      category: v.string(),
    }),
    financialTableSnapshot: v.object({
      financialTableId: v.string(),
      version: v.number(),
      tableCode: v.string(),
      displayName: v.string(),
      description: v.optional(v.string()),
      network,
      category: v.string(),
      minimumAmount: v.number(),
      maximumAmount: v.number(),
      minimumDurationMonths: v.number(),
      maximumDurationMonths: v.number(),
      durationStepMonths: v.number(),
      durationTerms: v.optional(v.array(durationTerm)),
      customerTanPercent: v.number(),
      openingFeeType,
      openingFeeValue: v.number(),
      collectionFeePerInstallment: v.number(),
      installmentFeeType: v.optional(installmentFeeType),
      installmentFeeValue: v.optional(v.number()),
      internalCostPercentAt24Months: v.optional(v.number()),
      internalCostBase: v.optional(internalCostBase),
      activeCommissionPercent: v.optional(v.number()),
      activeCommissionBase: v.optional(activeCommissionBase),
      supportedFirstInstallmentDelayDays: v.array(v.number()),
      requiresManagerAuthorizationNotice: v.boolean(),
    }),
    durationTermSnapshot: v.optional(durationTermSnapshot),
    calculationInputSnapshot: v.object({
      requestedAmount: v.number(),
      durationMonths: v.number(),
      customerTanPercent: v.number(),
      openingFeeType,
      openingFeeValue: v.number(),
      collectionFeePerInstallment: v.number(),
      installmentFeeType: v.optional(installmentFeeType),
      installmentFeeValue: v.optional(v.number()),
      internalCostPercentApplied: v.optional(v.number()),
      internalCostPercentAt24Months: v.optional(v.number()),
      internalCostBase: v.optional(internalCostBase),
      activeCommissionPercent: v.optional(v.number()),
      activeCommissionBase: v.optional(activeCommissionBase),
      firstInstallmentDelayDays: v.number(),
    }),
    calculationSummary: v.optional(
      v.object({
        openingFeeAmount: v.number(),
        financedAmount: v.number(),
        durationMonths: v.number(),
        firstInstallmentDelayDays: v.number(),
        customerTanPercent: v.number(),
        regularBaseInstallmentAmount: v.number(),
        collectionFeePerInstallment: v.number(),
        installmentFeeType: v.optional(installmentFeeType),
        installmentFeeValue: v.optional(v.number()),
        regularTotalInstallmentAmount: v.number(),
        finalTotalInstallmentAmount: v.number(),
        taegPercent: v.optional(v.number()),
        taegCalculationSucceeded: v.boolean(),
        totalPrincipalRepaid: v.number(),
        totalCustomerInterest: v.number(),
        totalCollectionFees: v.number(),
        totalCustomerRepayment: v.number(),
        totalCustomerCosts: v.number(),
        internalCostBase: v.optional(internalCostBase),
        internalCostPercentApplied: v.number(),
        internalCostAmount: v.number(),
        netAmountPaidToCompany: v.number(),
        activeCommissionPercent: v.optional(v.number()),
        activeCommissionBase: v.optional(activeCommissionBase),
        activeCommissionAmount: v.optional(v.number()),
        companyEconomicValue: v.optional(v.number()),
      }),
    ),
    compatibilitySnapshot: v.object({
      status: resultGroup,
      reasons: v.array(v.string()),
      verificationReasons: v.array(v.string()),
      passedRules: v.array(
        v.object({
          ruleId: v.string(),
          ruleType: v.string(),
          message: v.optional(v.string()),
        }),
      ),
      failedRules: v.array(
        v.object({
          ruleId: v.string(),
          ruleType: v.string(),
          message: v.optional(v.string()),
          technicalReason: v.optional(v.string()),
        }),
      ),
      verificationRules: v.array(
        v.object({
          ruleId: v.string(),
          ruleType: v.string(),
          message: v.optional(v.string()),
          technicalReason: v.optional(v.string()),
        }),
      ),
    }),
    technicalExclusionReasons: v.array(v.string()),
    prioritySnapshot: v.object({
      isCompanyPriority: v.boolean(),
      priorityScore: v.number(),
      label: v.optional(v.string()),
      visibleReason: v.optional(v.string()),
    }),
    internalMessagesSnapshot: v.array(
      v.object({
        originalMessageId: v.string(),
        title: v.string(),
        message: v.string(),
        messageType: v.string(),
        iconType: v.string(),
        requiresPrivacyConfirmation: v.boolean(),
      }),
    ),
    requiresManagerAuthorizationNotice: v.boolean(),
    distanceFromTargetInstallment: v.optional(v.number()),
    isProposed: v.boolean(),
    proposedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_run", ["comparisonRunId"])
    .index("by_simulation", ["simulationId"])
    .index("by_simulation_created_at", ["simulationId", "createdAt"])
    .index("by_owner", ["ownerUserId"])
    .index("by_is_proposed", ["isProposed"]),

  financialCompanies: defineTable({
    name: v.string(),
    shortName: v.string(),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_is_active", ["isActive"]),

  financialProducts: defineTable({
    companyId: v.id("financialCompanies"),
    name: v.string(),
    code: v.optional(v.string()),
    category: productCategory,
    description: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_category", ["category"])
    .index("by_is_active", ["isActive"])
    .index("by_company_active", ["companyId", "isActive"]),

  financialTables: defineTable({
    companyId: v.id("financialCompanies"),
    productId: v.id("financialProducts"),
    network,
    tableCode: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    category: productCategory,
    minimumAmount: v.number(),
    maximumAmount: v.number(),
    minimumDurationMonths: v.number(),
    maximumDurationMonths: v.number(),
    durationStepMonths: v.number(),
    customerTanPercent: v.number(),
    openingFeeType,
    openingFeeValue: v.number(),
    collectionFeePerInstallment: v.number(),
    installmentFeeType: v.optional(installmentFeeType),
    installmentFeeValue: v.optional(v.number()),
    internalCostPercentAt24Months: v.optional(v.number()),
    internalCostBase: v.optional(internalCostBase),
    activeCommissionPercent: v.optional(v.number()),
    activeCommissionBase: v.optional(activeCommissionBase),
    durationTerms: v.optional(v.array(durationTerm)),
    firstInstallmentDelayDays: v.array(v.number()),
    requiresManagerAuthorizationNotice: v.boolean(),
    isActive: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
    adminNotes: v.optional(v.string()),
    version: v.number(),
    supersedesTableId: v.optional(v.id("financialTables")),
    createdByUserId: v.optional(v.id("appUsers")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_product", ["productId"])
    .index("by_network", ["network"])
    .index("by_is_active", ["isActive"])
    .index("by_network_active", ["network", "isActive"])
    .index("by_table_code", ["tableCode"])
    .index("by_company_network", ["companyId", "network"]),

  policySets: defineTable({
    companyId: v.id("financialCompanies"),
    productId: v.optional(v.id("financialProducts")),
    financialTableId: v.optional(v.id("financialTables")),
    network,
    name: v.string(),
    description: v.optional(v.string()),
    sourceReference: v.optional(v.string()),
    isActive: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
    version: v.number(),
    supersedesPolicySetId: v.optional(v.id("policySets")),
    createdByUserId: v.optional(v.id("appUsers")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_product", ["productId"])
    .index("by_financial_table", ["financialTableId"])
    .index("by_network", ["network"])
    .index("by_is_active", ["isActive"]),

  policyRules: defineTable({
    policySetId: v.id("policySets"),
    ruleType: policyRuleType,
    operator: policyOperator,
    numericValue: v.optional(v.number()),
    stringValue: v.optional(v.string()),
    booleanValue: v.optional(v.boolean()),
    stringValues: v.optional(v.array(v.string())),
    monthsBuffer: v.optional(v.number()),
    failureMessage: v.string(),
    verificationMessage: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
    sortOrder: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_policy_set", ["policySetId"])
    .index("by_policy_set_order", ["policySetId", "sortOrder"]),

  commercialPriorities: defineTable({
    network,
    companyId: v.optional(v.id("financialCompanies")),
    productId: v.optional(v.id("financialProducts")),
    financialTableId: v.optional(v.id("financialTables")),
    label: v.string(),
    internalReason: v.optional(v.string()),
    visibleReason: v.optional(v.string()),
    priorityScore: v.number(),
    isActive: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
    createdByUserId: v.optional(v.id("appUsers")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_network", ["network"])
    .index("by_is_active", ["isActive"])
    .index("by_network_active", ["network", "isActive"])
    .index("by_financial_table", ["financialTableId"]),

  internalMessages: defineTable({
    network,
    companyId: v.optional(v.id("financialCompanies")),
    productId: v.optional(v.id("financialProducts")),
    financialTableId: v.optional(v.id("financialTables")),
    title: v.string(),
    message: v.string(),
    messageType,
    iconType,
    requiresPrivacyConfirmation: v.boolean(),
    isActive: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
    createdByUserId: v.optional(v.id("appUsers")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_network", ["network"])
    .index("by_is_active", ["isActive"])
    .index("by_network_active", ["network", "isActive"])
    .index("by_financial_table", ["financialTableId"]),

  assistantConfigs: defineTable({
    name: v.string(),
    behaviorPrompt: v.string(),
    modelProvider: v.string(),
    modelName: v.string(),
    temperature: v.number(),
    maxOutputTokens: v.number(),
    isActive: v.boolean(),
    version: v.number(),
    supersedesConfigId: v.optional(v.id("assistantConfigs")),
    adminNotes: v.optional(v.string()),
    createdByUserId: v.optional(v.id("appUsers")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_is_active", ["isActive"])
    .index("by_version", ["version"]),

  knowledgeCards: defineTable({
    title: v.string(),
    content: v.string(),
    category: knowledgeCategory,
    network: knowledgeNetwork,
    companyId: v.optional(v.id("financialCompanies")),
    productId: v.optional(v.id("financialProducts")),
    financialTableId: v.optional(v.id("financialTables")),
    keywords: v.array(v.string()),
    priority: v.number(),
    alwaysInclude: v.boolean(),
    isAlert: v.boolean(),
    alertLabel: v.optional(v.string()),
    /**
     * Assenza del campo → internal_only (compatibilità schede 4A).
     */
    visibility: v.optional(
      v.union(v.literal("patient_safe"), v.literal("internal_only")),
    ),
    sourceReference: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
    showInFaq: v.optional(v.boolean()),
    faqQuestion: v.optional(v.string()),
    faqCategory: v.optional(v.string()),
    faqOrder: v.optional(v.number()),
    isActive: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
    version: v.number(),
    supersedesCardId: v.optional(v.id("knowledgeCards")),
    createdByUserId: v.optional(v.id("appUsers")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_network", ["network"])
    .index("by_company", ["companyId"])
    .index("by_product", ["productId"])
    .index("by_financial_table", ["financialTableId"])
    .index("by_is_active", ["isActive"]),

  assistantConversations: defineTable({
    ownerUserId: v.id("appUsers"),
    title: v.string(),
    simulationId: v.optional(v.id("simulations")),
    comparisonRunId: v.optional(v.id("simulationComparisonRuns")),
    privacyMode: v.union(v.literal("patient_safe"), v.literal("internal")),
    status: v.union(v.literal("active"), v.literal("archived")),
    lastMessageAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerUserId"])
    .index("by_owner_updated_at", ["ownerUserId", "updatedAt"])
    .index("by_simulation", ["simulationId"]),

  assistantMessages: defineTable({
    conversationId: v.id("assistantConversations"),
    ownerUserId: v.id("appUsers"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    requestId: v.string(),
    privacyMode: v.union(v.literal("patient_safe"), v.literal("internal")),
    outcome: v.optional(
      v.union(
        v.literal("answered"),
        v.literal("needs_information"),
        v.literal("requires_verification"),
        v.literal("not_covered"),
      ),
    ),
    requiresVerification: v.optional(v.boolean()),
    verificationTarget: v.optional(
      v.union(
        v.literal("none"),
        v.literal("area_manager"),
        v.literal("financial_company"),
        v.literal("both"),
      ),
    ),
    alerts: v.optional(v.array(v.string())),
    missingInformation: v.optional(v.array(v.string())),
    assistantConfigId: v.optional(v.id("assistantConfigs")),
    assistantConfigVersion: v.optional(v.number()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    providerResponseId: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    knowledgeCardsProvided: v.optional(v.number()),
    usedPreScreeningContext: v.optional(v.boolean()),
    preScreeningIntents: v.optional(v.array(v.string())),
    matchedCompanyIds: v.optional(v.array(v.id("financialCompanies"))),
    simulationId: v.optional(v.id("simulations")),
    comparisonRunId: v.optional(v.id("simulationComparisonRuns")),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_created_at", ["conversationId", "createdAt"])
    .index("by_request_id", ["requestId"])
    .index("by_owner", ["ownerUserId"])
    .index("by_status", ["status"]),

  assistantMessageSources: defineTable({
    assistantMessageId: v.id("assistantMessages"),
    conversationId: v.id("assistantConversations"),
    knowledgeCardId: v.id("knowledgeCards"),
    knowledgeCardVersion: v.number(),
    titleSnapshot: v.string(),
    categorySnapshot: v.string(),
    score: v.number(),
    matchReasons: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_message", ["assistantMessageId"])
    .index("by_conversation", ["conversationId"])
    .index("by_knowledge_card", ["knowledgeCardId"]),
});
