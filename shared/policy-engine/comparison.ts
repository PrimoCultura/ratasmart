import {
  calculateFinancialSolution,
  generateAllowedDurations,
} from "../financial-engine/index.ts";
import type { FinancialCalculationResult } from "../financial-engine/types.ts";
import { evaluateCompatibility } from "./compatibility.ts";
import {
  findNearestTargetSolution,
  rankFinancialSolutions,
} from "./ranking.ts";
import type {
  CompatibilityEvaluation,
  PatientFinancialProfile,
  RuntimeFinancialSolution,
  RuntimePolicyRule,
  SimulationComparisonResult,
} from "./types.ts";
import {
  FISCAL_WARNING,
  FORMAL_COMPATIBILITY_DISCLAIMER,
} from "./types.ts";

export type RuntimeCompany = {
  id: string;
  name: string;
  shortName: string;
  isActive: boolean;
};

export type RuntimeProduct = {
  id: string;
  companyId: string;
  name: string;
  code?: string;
  isActive: boolean;
};

export type RuntimeFinancialTable = {
  id: string;
  companyId: string;
  productId: string;
  network: "PCG" | "DES";
  tableCode: string;
  displayName: string;
  description?: string;
  category: string;
  version: number;
  minimumAmount: number;
  maximumAmount: number;
  minimumDurationMonths: number;
  maximumDurationMonths: number;
  durationStepMonths: number;
  customerTanPercent: number;
  openingFeeType: "none" | "fixed" | "percentage";
  openingFeeValue: number;
  collectionFeePerInstallment: number;
  internalCostPercentAt24Months?: number;
  firstInstallmentDelayDays: number[];
  requiresManagerAuthorizationNotice: boolean;
  isActive: boolean;
};

export type RuntimePriority = {
  id: string;
  network: "PCG" | "DES";
  companyId?: string;
  productId?: string;
  financialTableId?: string;
  label: string;
  visibleReason?: string;
  priorityScore: number;
};

export type RuntimeInternalMessage = {
  id: string;
  network: "PCG" | "DES";
  companyId?: string;
  productId?: string;
  financialTableId?: string;
};

export type ComparisonBuildInput = {
  simulationId: string;
  network: "PCG" | "DES";
  calculationDate: number;
  patient: PatientFinancialProfile;
  requestedAmount: number;
  targetInstallment?: number;
  preferredDurationMonths?: number;
  preferredFirstInstallmentDelayDays?: number;
  selectedDurationMonths?: number;
  selectedFirstInstallmentDelayDays?: number;
  companies: RuntimeCompany[];
  products: RuntimeProduct[];
  tables: RuntimeFinancialTable[];
  rulesByTableId: Record<string, RuntimePolicyRule[]>;
  priorities: RuntimePriority[];
  internalMessages: RuntimeInternalMessage[];
};

function emptyCompatibility(
  reasons: string[],
): CompatibilityEvaluation {
  return {
    status: "not_compatible",
    passedRules: [],
    failedRules: [],
    verificationRules: [],
    notApplicableRules: [],
    reasons,
    verificationReasons: [],
  };
}

function resolvePriority(
  table: RuntimeFinancialTable,
  priorities: RuntimePriority[],
): {
  priorityScore: number;
  priorityLabel?: string;
  priorityVisibleReason?: string;
} {
  const applicable = priorities.filter((item) => {
    if (item.financialTableId) {
      return item.financialTableId === table.id;
    }
    if (item.productId) {
      return item.productId === table.productId && !item.financialTableId;
    }
    if (item.companyId) {
      return item.companyId === table.companyId && !item.productId;
    }
    return !item.companyId && !item.productId && !item.financialTableId;
  });

  if (applicable.length === 0) {
    return { priorityScore: 0 };
  }

  const maxScore = Math.max(...applicable.map((item) => item.priorityScore));
  const top = applicable
    .filter((item) => item.priorityScore === maxScore)
    .sort((a, b) => {
      const specificity = (item: RuntimePriority) => {
        if (item.financialTableId) return 3;
        if (item.productId) return 2;
        if (item.companyId) return 1;
        return 0;
      };
      return specificity(b) - specificity(a);
    })[0];

  return {
    priorityScore: maxScore,
    priorityLabel: top?.label,
    priorityVisibleReason: top?.visibleReason,
  };
}

function resolveMessages(
  table: RuntimeFinancialTable,
  messages: RuntimeInternalMessage[],
): string[] {
  return messages
    .filter((item) => {
      if (item.financialTableId) return item.financialTableId === table.id;
      if (item.productId) {
        return item.productId === table.productId && !item.financialTableId;
      }
      if (item.companyId) {
        return item.companyId === table.companyId && !item.productId;
      }
      return true;
    })
    .map((item) => item.id);
}

function technicalCheck(
  table: RuntimeFinancialTable,
  requestedAmount: number,
  durationMonths: number,
  delayDays: number,
): string[] {
  const reasons: string[] = [];
  if (requestedAmount < table.minimumAmount) {
    reasons.push("Importo inferiore al minimo della tabella.");
  }
  if (requestedAmount > table.maximumAmount) {
    reasons.push("Importo superiore al massimo della tabella.");
  }
  const durations = generateAllowedDurations({
    minimumDurationMonths: table.minimumDurationMonths,
    maximumDurationMonths: table.maximumDurationMonths,
    durationStepMonths: table.durationStepMonths,
  });
  if (!durations.includes(durationMonths)) {
    reasons.push("Durata non prevista dalla tabella.");
  }
  if (!table.firstInstallmentDelayDays.includes(delayDays)) {
    reasons.push(
      `Prima rata a ${delayDays} giorni non prevista dalla tabella.`,
    );
  }
  return reasons;
}

function buildSolutionId(
  tableId: string,
  durationMonths: number,
  delayDays: number,
): string {
  return `${tableId}:${durationMonths}:${delayDays}`;
}

export function collectAvailableDurations(
  tables: RuntimeFinancialTable[],
): number[] {
  const set = new Set<number>();
  for (const table of tables) {
    const durations = generateAllowedDurations({
      minimumDurationMonths: table.minimumDurationMonths,
      maximumDurationMonths: table.maximumDurationMonths,
      durationStepMonths: table.durationStepMonths,
    });
    for (const duration of durations) {
      set.add(duration);
    }
  }
  return [...set].sort((a, b) => a - b);
}

export function resolveInitialDuration(input: {
  tables: RuntimeFinancialTable[];
  preferredDurationMonths?: number;
  targetInstallment?: number;
  patient: PatientFinancialProfile;
  requestedAmount: number;
  delayDays: number;
  calculationDate: number;
  rulesByTableId: Record<string, RuntimePolicyRule[]>;
}): { duration: number; warning?: string } {
  const available = collectAvailableDurations(input.tables);

  if (input.preferredDurationMonths !== undefined) {
    // Non sostituire silenziosamente: usa la durata scelta dal CM anche se
    // nessuna tabella la supporta (risulteranno "non compatibili").
    if (!available.includes(input.preferredDurationMonths)) {
      const nearest = available
        .map((duration) => ({
          duration,
          distance: Math.abs(duration - input.preferredDurationMonths!),
        }))
        .sort((a, b) => a.distance - b.distance || a.duration - b.duration)
        .slice(0, 3)
        .map((item) => item.duration);
      const suggestion =
        nearest.length > 0
          ? ` Durate comuni più vicine: ${nearest.join(", ")} mesi.`
          : "";
      return {
        duration: input.preferredDurationMonths,
        warning: `La durata richiesta non è supportata da alcuna tabella attiva.${suggestion}`,
      };
    }
    return { duration: input.preferredDurationMonths };
  }

  if (input.targetInstallment !== undefined && available.length > 0) {
    let best:
      | {
          duration: number;
          distance: number;
        }
      | undefined;

    for (const table of input.tables) {
      const durations = generateAllowedDurations({
        minimumDurationMonths: table.minimumDurationMonths,
        maximumDurationMonths: table.maximumDurationMonths,
        durationStepMonths: table.durationStepMonths,
      });

      for (const duration of durations) {
        const technical = technicalCheck(
          table,
          input.requestedAmount,
          duration,
          input.delayDays,
        );
        if (technical.length > 0) continue;

        let calculation: FinancialCalculationResult;
        try {
          calculation = calculateFinancialSolution({
            requestedAmount: input.requestedAmount,
            durationMonths: duration,
            customerTanPercent: table.customerTanPercent,
            openingFeeType: table.openingFeeType,
            openingFeeValue: table.openingFeeValue,
            collectionFeePerInstallment: table.collectionFeePerInstallment,
            internalCostPercentAt24Months: table.internalCostPercentAt24Months,
            firstInstallmentDelayDays: input.delayDays,
          });
        } catch {
          continue;
        }

        const compatibility = evaluateCompatibility({
          patient: input.patient,
          requestedAmount: input.requestedAmount,
          durationMonths: duration,
          firstInstallmentDelayDays: input.delayDays,
          calculationDate: input.calculationDate,
          rules: input.rulesByTableId[table.id] ?? [],
        });

        if (compatibility.status !== "compatible") continue;

        const distance = Math.abs(
          calculation.regularTotalInstallmentAmount - input.targetInstallment,
        );
        if (!best || distance < best.distance) {
          best = { duration, distance };
        }
      }
    }

    if (best) {
      return { duration: best.duration };
    }
  }

  if (available.includes(24)) {
    return { duration: 24 };
  }

  if (available.length === 0) {
    return { duration: 24, warning: "Nessuna durata disponibile." };
  }

  const nearestTo24 = available
    .map((duration) => ({
      duration,
      distance: Math.abs(duration - 24),
    }))
    .sort((a, b) => a.distance - b.distance || a.duration - b.duration)[0];

  return { duration: nearestTo24?.duration ?? available[0]! };
}

export function buildComparisonResult(
  input: ComparisonBuildInput,
): SimulationComparisonResult {
  const delayDays =
    input.selectedFirstInstallmentDelayDays ??
    input.preferredFirstInstallmentDelayDays ??
    30;

  const availableComparisonDurations = collectAvailableDurations(input.tables);
  const warnings: string[] = [];

  let selectedDurationMonths = input.selectedDurationMonths;
  if (selectedDurationMonths === undefined) {
    const resolved = resolveInitialDuration({
      tables: input.tables,
      preferredDurationMonths: input.preferredDurationMonths,
      targetInstallment: input.targetInstallment,
      patient: input.patient,
      requestedAmount: input.requestedAmount,
      delayDays,
      calculationDate: input.calculationDate,
      rulesByTableId: input.rulesByTableId,
    });
    selectedDurationMonths = resolved.duration;
    if (resolved.warning) {
      warnings.push(resolved.warning);
    }
  }

  const companyMap = new Map(input.companies.map((item) => [item.id, item]));
  const productMap = new Map(input.products.map((item) => [item.id, item]));

  const solutions: RuntimeFinancialSolution[] = [];

  for (const table of input.tables) {
    const company = companyMap.get(table.companyId);
    const product = productMap.get(table.productId);
    if (!company || !product) {
      continue;
    }

    const technicalExclusionReasons = technicalCheck(
      table,
      input.requestedAmount,
      selectedDurationMonths,
      delayDays,
    );

    const priority = resolvePriority(table, input.priorities);
    const messageIds = resolveMessages(table, input.internalMessages);

    let calculation: FinancialCalculationResult | null = null;
    let compatibility: CompatibilityEvaluation;

    if (technicalExclusionReasons.length > 0) {
      compatibility = emptyCompatibility(technicalExclusionReasons);
    } else {
      try {
        calculation = calculateFinancialSolution({
          requestedAmount: input.requestedAmount,
          durationMonths: selectedDurationMonths,
          customerTanPercent: table.customerTanPercent,
          openingFeeType: table.openingFeeType,
          openingFeeValue: table.openingFeeValue,
          collectionFeePerInstallment: table.collectionFeePerInstallment,
          internalCostPercentAt24Months: table.internalCostPercentAt24Months,
          firstInstallmentDelayDays: delayDays,
        });
        compatibility = evaluateCompatibility({
          patient: input.patient,
          requestedAmount: input.requestedAmount,
          durationMonths: selectedDurationMonths,
          firstInstallmentDelayDays: delayDays,
          calculationDate: input.calculationDate,
          rules: input.rulesByTableId[table.id] ?? [],
        });
      } catch (error) {
        compatibility = emptyCompatibility([
          error instanceof Error
            ? error.message
            : "Errore nel calcolo finanziario.",
        ]);
      }
    }

    const isCompatible = compatibility.status === "compatible";
    const distanceFromTargetInstallment =
      input.targetInstallment !== undefined && calculation
        ? calculation.regularTotalInstallmentAmount - input.targetInstallment
        : undefined;

    const durationAlternatives = buildDurationAlternatives({
      table,
      patient: input.patient,
      requestedAmount: input.requestedAmount,
      delayDays,
      calculationDate: input.calculationDate,
      rules: input.rulesByTableId[table.id] ?? [],
    });

    solutions.push({
      solutionId: buildSolutionId(
        table.id,
        selectedDurationMonths,
        delayDays,
      ),
      companyId: company.id,
      companyName: company.name,
      companyShortName: company.shortName,
      productId: product.id,
      productName: product.name,
      financialTableId: table.id,
      financialTableVersion: table.version,
      tableCode: table.tableCode,
      tableDisplayName: table.displayName,
      category: table.category,
      network: table.network,
      durationMonths: selectedDurationMonths,
      firstInstallmentDelayDays: delayDays,
      calculation,
      compatibility,
      isCompanyPriority: isCompatible && priority.priorityScore > 0,
      priorityScore: isCompatible ? priority.priorityScore : 0,
      priorityLabel:
        isCompatible && priority.priorityScore > 0
          ? priority.priorityLabel
          : undefined,
      priorityVisibleReason:
        isCompatible && priority.priorityScore > 0
          ? priority.priorityVisibleReason
          : undefined,
      internalMessageIds: messageIds,
      requiresManagerAuthorizationNotice:
        table.requiresManagerAuthorizationNotice ||
        table.category === "zero_interest" ||
        table.category === "subsidized" ||
        (calculation?.internalCostAmount ?? 0) > 0,
      distanceFromTargetInstallment,
      technicalExclusionReasons,
      durationAlternatives,
    });
  }

  const ranked = rankFinancialSolutions(solutions);
  const nearest = input.targetInstallment
    ? findNearestTargetSolution(ranked, input.targetInstallment)
    : undefined;

  return {
    simulationId: input.simulationId,
    calculationDate: input.calculationDate,
    network: input.network,
    selectedDurationMonths,
    selectedFirstInstallmentDelayDays: delayDays,
    targetInstallment: input.targetInstallment,
    compatibleSolutions: ranked.filter(
      (item) => item.compatibility.status === "compatible",
    ),
    verificationRequiredSolutions: ranked.filter(
      (item) => item.compatibility.status === "verification_required",
    ),
    incompatibleSolutions: ranked.filter(
      (item) => item.compatibility.status === "not_compatible",
    ),
    availableComparisonDurations,
    nearestTargetSolutionId: nearest?.solutionId,
    disclaimer: FORMAL_COMPATIBILITY_DISCLAIMER,
    fiscalWarning: FISCAL_WARNING,
    warnings,
  };
}

export function buildDurationAlternatives(input: {
  table: RuntimeFinancialTable;
  patient: PatientFinancialProfile;
  requestedAmount: number;
  delayDays: number;
  calculationDate: number;
  rules: RuntimePolicyRule[];
}): Array<{
  durationMonths: number;
  calculation: FinancialCalculationResult | null;
  compatibility: CompatibilityEvaluation;
  technicalExclusionReasons: string[];
}> {
  const durations = generateAllowedDurations({
    minimumDurationMonths: input.table.minimumDurationMonths,
    maximumDurationMonths: input.table.maximumDurationMonths,
    durationStepMonths: input.table.durationStepMonths,
  });

  return durations.map((durationMonths) => {
    const technicalExclusionReasons = technicalCheck(
      input.table,
      input.requestedAmount,
      durationMonths,
      input.delayDays,
    );

    if (technicalExclusionReasons.length > 0) {
      return {
        durationMonths,
        calculation: null,
        compatibility: emptyCompatibility(technicalExclusionReasons),
        technicalExclusionReasons,
      };
    }

    try {
      const calculation = calculateFinancialSolution({
        requestedAmount: input.requestedAmount,
        durationMonths,
        customerTanPercent: input.table.customerTanPercent,
        openingFeeType: input.table.openingFeeType,
        openingFeeValue: input.table.openingFeeValue,
        collectionFeePerInstallment: input.table.collectionFeePerInstallment,
        internalCostPercentAt24Months:
          input.table.internalCostPercentAt24Months,
        firstInstallmentDelayDays: input.delayDays,
      });
      const compatibility = evaluateCompatibility({
        patient: input.patient,
        requestedAmount: input.requestedAmount,
        durationMonths,
        firstInstallmentDelayDays: input.delayDays,
        calculationDate: input.calculationDate,
        rules: input.rules,
      });
      return {
        durationMonths,
        calculation,
        compatibility,
        technicalExclusionReasons,
      };
    } catch (error) {
      return {
        durationMonths,
        calculation: null,
        compatibility: emptyCompatibility([
          error instanceof Error
            ? error.message
            : "Errore nel calcolo finanziario.",
        ]),
        technicalExclusionReasons: [],
      };
    }
  });
}
