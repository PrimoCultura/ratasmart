import type {
  FinancialCalculationResult,
} from "../financial-engine/types.ts";
import type {
  CompatibilityEvaluation,
  RuntimeFinancialSolution,
  SimulationComparisonResult,
} from "../policy-engine/types.ts";
import { normalizeOptional, stripUndefinedDeep } from "./normalize.ts";
import type {
  CalculationInputSnapshot,
  CalculationSummarySnapshot,
  ComparisonRunFields,
  ComparisonSource,
  CompatibilitySnapshot,
  InternalMessageSnapshot,
  MessagePayloadForSnapshot,
  PatientSnapshot,
  PersistentSolutionFields,
  ProductMetadataForSnapshot,
  ResultGroup,
  TableMetadataForSnapshot,
} from "./types.ts";

export type MapRunInput = {
  result: SimulationComparisonResult;
  patientSnapshot: PatientSnapshot;
  requestedAmount: number;
  engineVersion: string;
  policyEngineVersion: string;
  source: ComparisonSource;
};

export type MapSolutionInput = {
  solution: RuntimeFinancialSolution;
  resultGroup: ResultGroup;
  rankPosition: number;
  table: TableMetadataForSnapshot;
  product?: ProductMetadataForSnapshot;
  messagesById: Record<string, MessagePayloadForSnapshot>;
};

/**
 * Mappa il risultato runtime nei campi persistenti del run (senza Id Convex).
 */
export function mapRuntimeComparisonToRunFields(
  input: MapRunInput,
): ComparisonRunFields {
  const { result } = input;
  const fields: ComparisonRunFields = {
    calculationDate: result.calculationDate,
    network: result.network,
    selectedDurationMonths: result.selectedDurationMonths,
    selectedFirstInstallmentDelayDays: result.selectedFirstInstallmentDelayDays,
    requestedAmount: input.requestedAmount,
    patientSnapshot: stripUndefinedDeep(input.patientSnapshot),
    compatibleSolutionsCount: result.compatibleSolutions.length,
    verificationRequiredSolutionsCount:
      result.verificationRequiredSolutions.length,
    incompatibleSolutionsCount: result.incompatibleSolutions.length,
    disclaimer: result.disclaimer,
    fiscalWarning: result.fiscalWarning,
    warnings: [...result.warnings],
    engineVersion: input.engineVersion,
    policyEngineVersion: input.policyEngineVersion,
    source: input.source,
  };

  const target = normalizeOptional(result.targetInstallment);
  if (target !== undefined) {
    fields.targetInstallment = target;
  }

  const nearest = normalizeOptional(result.nearestTargetSolutionId);
  if (nearest !== undefined) {
    fields.nearestTargetSolutionRuntimeId = nearest;
  }

  return stripUndefinedDeep(fields);
}

/**
 * Estrae il riepilogo calcolo senza piano di ammortamento.
 * Restituisce undefined se calculation è null (esclusione tecnica / errore).
 */
export function mapCalculationSummary(
  calculation: FinancialCalculationResult | null,
): CalculationSummarySnapshot | undefined {
  if (!calculation) {
    return undefined;
  }

  const taegSucceeded = calculation.estimatedTaeg.success === true;
  const summary: CalculationSummarySnapshot = {
    openingFeeAmount: calculation.openingFeeAmount,
    financedAmount: calculation.financedAmount,
    durationMonths: calculation.durationMonths,
    firstInstallmentDelayDays: calculation.firstInstallmentDelayDays,
    customerTanPercent: calculation.customerTanPercent,
    regularBaseInstallmentAmount: calculation.regularBaseInstallmentAmount,
    collectionFeePerInstallment: calculation.collectionFeePerInstallment,
    installmentFeeType: calculation.installmentFeeType,
    installmentFeeValue: calculation.installmentFeeValue,
    regularTotalInstallmentAmount: calculation.regularTotalInstallmentAmount,
    finalTotalInstallmentAmount: calculation.finalTotalInstallmentAmount,
    taegCalculationSucceeded: taegSucceeded,
    totalPrincipalRepaid: calculation.totalPrincipalRepaid,
    totalCustomerInterest: calculation.totalCustomerInterest,
    totalCollectionFees: calculation.totalCollectionFees,
    totalCustomerRepayment: calculation.totalCustomerRepayment,
    totalCustomerCosts: calculation.totalCustomerCosts,
    internalCostBase: calculation.internalCostBase,
    internalCostPercentApplied: calculation.internalCostPercentApplied,
    internalCostAmount: calculation.internalCostAmount,
    netAmountPaidToCompany: calculation.netAmountPaidToCompany,
  };

  if (
    taegSucceeded &&
    calculation.estimatedTaeg.taegPercent !== null &&
    calculation.estimatedTaeg.taegPercent !== undefined
  ) {
    summary.taegPercent = calculation.estimatedTaeg.taegPercent;
  }

  return summary;
}

export function mapCalculationInputSnapshot(
  solution: RuntimeFinancialSolution,
  table: TableMetadataForSnapshot,
): CalculationInputSnapshot {
  const input: CalculationInputSnapshot = {
    requestedAmount:
      solution.calculation?.requestedAmount ??
      // fallback: non disponibile sul runtime solution; il chiamante passa requestedAmount via table context
      0,
    durationMonths: solution.durationMonths,
    customerTanPercent:
      solution.calculation?.customerTanPercent ??
      solution.durationTermSnapshot?.customerTanPercent ??
      table.customerTanPercent,
    openingFeeType: table.openingFeeType,
    openingFeeValue: table.openingFeeValue,
    collectionFeePerInstallment:
      solution.calculation?.collectionFeePerInstallment ??
      table.collectionFeePerInstallment,
    firstInstallmentDelayDays: solution.firstInstallmentDelayDays,
  };

  const feeType = normalizeOptional(
    solution.calculation?.installmentFeeType ?? table.installmentFeeType,
  );
  if (feeType !== undefined) {
    input.installmentFeeType = feeType;
  }
  const feeValue = normalizeOptional(
    solution.calculation?.installmentFeeValue ?? table.installmentFeeValue,
  );
  if (feeValue !== undefined) {
    input.installmentFeeValue = feeValue;
  }

  const costBase = normalizeOptional(
    solution.calculation?.internalCostBase ?? table.internalCostBase,
  );
  if (costBase !== undefined) {
    input.internalCostBase = costBase;
  }

  const appliedFromTerm = normalizeOptional(
    solution.durationTermSnapshot?.internalCostPercent,
  );
  const appliedFromCalc = normalizeOptional(
    solution.calculation?.internalCostPercentApplied,
  );
  if (appliedFromTerm !== undefined) {
    input.internalCostPercentApplied = appliedFromTerm;
  } else if (
    appliedFromCalc !== undefined &&
    solution.durationTermSnapshot !== undefined
  ) {
    input.internalCostPercentApplied = appliedFromCalc;
  } else if (
    appliedFromCalc !== undefined &&
    table.internalCostPercentAt24Months === undefined
  ) {
    input.internalCostPercentApplied = appliedFromCalc;
  }

  const internal = normalizeOptional(table.internalCostPercentAt24Months);
  if (internal !== undefined && input.internalCostPercentApplied === undefined) {
    input.internalCostPercentAt24Months = internal;
  }

  // Preferisci l'importo dal calcolo se presente
  if (solution.calculation) {
    input.requestedAmount = solution.calculation.requestedAmount;
  }

  return input;
}

function mapRuleForSnapshot(rule: {
  ruleId: string;
  ruleType: string;
  message?: string;
  technicalReason?: string;
}): {
  ruleId: string;
  ruleType: string;
  message?: string;
  technicalReason?: string;
} {
  const mapped: {
    ruleId: string;
    ruleType: string;
    message?: string;
    technicalReason?: string;
  } = {
    ruleId: rule.ruleId,
    ruleType: rule.ruleType,
  };
  const message = normalizeOptional(rule.message);
  if (message !== undefined) {
    mapped.message = message;
  }
  const technicalReason = normalizeOptional(rule.technicalReason);
  if (technicalReason !== undefined) {
    mapped.technicalReason = technicalReason;
  }
  return mapped;
}

/**
 * Snapshot compatibilità: esclude regole not_applicable.
 */
export function mapCompatibilitySnapshot(
  compatibility: CompatibilityEvaluation,
): CompatibilitySnapshot {
  return {
    status: compatibility.status,
    reasons: [...compatibility.reasons],
    verificationReasons: [...compatibility.verificationReasons],
    passedRules: compatibility.passedRules.map((rule) => {
      const mapped: { ruleId: string; ruleType: string; message?: string } = {
        ruleId: rule.ruleId,
        ruleType: rule.ruleType,
      };
      const message = normalizeOptional(rule.message);
      if (message !== undefined) {
        mapped.message = message;
      }
      return mapped;
    }),
    failedRules: compatibility.failedRules.map(mapRuleForSnapshot),
    verificationRules: compatibility.verificationRules.map(mapRuleForSnapshot),
  };
}

export function mapInternalMessagesSnapshot(
  messageIds: string[],
  messagesById: Record<string, MessagePayloadForSnapshot>,
): InternalMessageSnapshot[] {
  const snapshots: InternalMessageSnapshot[] = [];
  for (const id of messageIds) {
    const payload = messagesById[id];
    if (!payload) {
      continue;
    }
    snapshots.push({
      originalMessageId: payload.id,
      title: payload.title,
      message: payload.message,
      messageType: payload.messageType,
      iconType: payload.iconType,
      requiresPrivacyConfirmation:
        payload.requiresPrivacyConfirmation ?? false,
    });
  }
  return snapshots;
}

/**
 * Mappa una soluzione runtime in campi persistenti (senza ammortamento).
 */
export function mapRuntimeSolutionToPersistentSnapshot(
  input: MapSolutionInput,
): PersistentSolutionFields {
  const { solution, table, product } = input;

  const calculationSummary = mapCalculationSummary(solution.calculation);
  const calculationInputSnapshot = mapCalculationInputSnapshot(solution, table);

  // Se c'è un calcolo, allinea requestedAmount; altrimenti usa 0 solo se
  // non abbiamo modo migliore — il chiamante Convex passa requestedAmount
  // correggendolo dopo. Qui preferiamo calculation.requestedAmount.
  if (!solution.calculation && calculationInputSnapshot.requestedAmount === 0) {
    // leave as-is; Convex layer may patch via override
  }

  const fields: PersistentSolutionFields = {
    runtimeSolutionId: solution.solutionId,
    resultGroup: input.resultGroup,
    rankPosition: input.rankPosition,
    companySnapshot: {
      companyId: solution.companyId,
      name: solution.companyName,
      shortName: solution.companyShortName,
    },
    productSnapshot: stripUndefinedDeep({
      productId: solution.productId,
      name: solution.productName,
      code: normalizeOptional(product?.code),
      category: product?.category ?? solution.category,
    }),
    financialTableSnapshot: stripUndefinedDeep({
      financialTableId: table.id,
      version: table.version,
      tableCode: table.tableCode,
      displayName: table.displayName,
      description: normalizeOptional(table.description),
      network: table.network,
      category: table.category,
      minimumAmount: table.minimumAmount,
      maximumAmount: table.maximumAmount,
      minimumDurationMonths: table.minimumDurationMonths,
      maximumDurationMonths: table.maximumDurationMonths,
      durationStepMonths: table.durationStepMonths,
      durationTerms: table.durationTerms
        ? table.durationTerms.map((term) =>
            stripUndefinedDeep({
              durationMonths: term.durationMonths,
              minimumAmount: term.minimumAmount,
              maximumAmount: term.maximumAmount,
              customerTanPercent: normalizeOptional(term.customerTanPercent),
              internalCostPercent: normalizeOptional(term.internalCostPercent),
            }),
          )
        : undefined,
      customerTanPercent: table.customerTanPercent,
      openingFeeType: table.openingFeeType,
      openingFeeValue: table.openingFeeValue,
      collectionFeePerInstallment: table.collectionFeePerInstallment,
      installmentFeeType: normalizeOptional(table.installmentFeeType),
      installmentFeeValue: normalizeOptional(table.installmentFeeValue),
      internalCostPercentAt24Months: normalizeOptional(
        table.internalCostPercentAt24Months,
      ),
      internalCostBase: normalizeOptional(table.internalCostBase),
      supportedFirstInstallmentDelayDays: [
        ...table.firstInstallmentDelayDays,
      ],
      requiresManagerAuthorizationNotice:
        table.requiresManagerAuthorizationNotice,
    }),
    calculationInputSnapshot: stripUndefinedDeep(calculationInputSnapshot),
    compatibilitySnapshot: mapCompatibilitySnapshot(solution.compatibility),
    technicalExclusionReasons: [...solution.technicalExclusionReasons],
    prioritySnapshot: stripUndefinedDeep({
      isCompanyPriority: solution.isCompanyPriority,
      priorityScore: solution.priorityScore,
      label: normalizeOptional(solution.priorityLabel),
      visibleReason: normalizeOptional(solution.priorityVisibleReason),
    }),
    internalMessagesSnapshot: mapInternalMessagesSnapshot(
      solution.internalMessageIds,
      input.messagesById,
    ),
    requiresManagerAuthorizationNotice:
      solution.requiresManagerAuthorizationNotice,
  };

  if (solution.durationTermSnapshot) {
    fields.durationTermSnapshot = stripUndefinedDeep({
      durationMonths: solution.durationTermSnapshot.durationMonths,
      minimumAmount: solution.durationTermSnapshot.minimumAmount,
      maximumAmount: solution.durationTermSnapshot.maximumAmount,
      customerTanPercent: solution.durationTermSnapshot.customerTanPercent,
      internalCostPercent: normalizeOptional(
        solution.durationTermSnapshot.internalCostPercent,
      ),
    });
  }

  if (calculationSummary) {
    fields.calculationSummary = calculationSummary;
  }

  const distance = normalizeOptional(solution.distanceFromTargetInstallment);
  if (distance !== undefined) {
    fields.distanceFromTargetInstallment = distance;
  }

  return stripUndefinedDeep(fields);
}

/**
 * Mappa tutte le soluzioni del risultato con ranking per gruppo.
 */
export function mapAllSolutionsFromComparison(input: {
  result: SimulationComparisonResult;
  tablesById: Record<string, TableMetadataForSnapshot>;
  productsById: Record<string, ProductMetadataForSnapshot>;
  messagesById: Record<string, MessagePayloadForSnapshot>;
  requestedAmount: number;
}): PersistentSolutionFields[] {
  const groups: Array<{
    group: ResultGroup;
    solutions: RuntimeFinancialSolution[];
  }> = [
    { group: "compatible", solutions: input.result.compatibleSolutions },
    {
      group: "verification_required",
      solutions: input.result.verificationRequiredSolutions,
    },
    {
      group: "not_compatible",
      solutions: input.result.incompatibleSolutions,
    },
  ];

  const mapped: PersistentSolutionFields[] = [];

  for (const { group, solutions } of groups) {
    solutions.forEach((solution, index) => {
      const table = input.tablesById[solution.financialTableId];
      if (!table) {
        throw new Error(
          `Metadata tabella mancante per ${solution.financialTableId}.`,
        );
      }
      const fields = mapRuntimeSolutionToPersistentSnapshot({
        solution,
        resultGroup: group,
        rankPosition: index + 1,
        table,
        product: input.productsById[solution.productId],
        messagesById: input.messagesById,
      });

      if (
        !solution.calculation &&
        fields.calculationInputSnapshot.requestedAmount === 0
      ) {
        fields.calculationInputSnapshot.requestedAmount = input.requestedAmount;
      }

      mapped.push(fields);
    });
  }

  return mapped;
}

/**
 * Una soluzione può essere proposta solo se compatibile, con calcolo, e dello stesso CM.
 */
export function canProposeSolution(input: {
  resultGroup: ResultGroup;
  hasCalculationSummary: boolean;
  solutionOwnerUserId: string;
  simulationOwnerUserId: string;
}): boolean {
  return (
    input.resultGroup === "compatible" &&
    input.hasCalculationSummary &&
    input.solutionOwnerUserId === input.simulationOwnerUserId
  );
}

export function buildSelectedSolutionLabel(solution: {
  companyShortName: string;
  tableCode: string;
  durationMonths: number;
}): string {
  return `${solution.companyShortName} · ${solution.tableCode} · ${solution.durationMonths}m`;
}
