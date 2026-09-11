import {
  calculateFinancialSolution,
  findDurationTerm,
  hasDurationTerms,
  resolveAllowedDurations,
  type DurationTerm,
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
  durationTerms?: DurationTerm[];
  customerTanPercent: number;
  openingFeeType: "none" | "fixed" | "percentage";
  openingFeeValue: number;
  collectionFeePerInstallment: number;
  installmentFeeType?: "none" | "fixed" | "percentage_of_requested_amount";
  installmentFeeValue?: number;
  internalCostPercentAt24Months?: number;
  internalCostBase?: "requested_amount" | "financed_amount";
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

export type DurationTermSnapshot = {
  durationMonths: number;
  minimumAmount: number;
  maximumAmount: number;
  customerTanPercent: number;
  internalCostPercent?: number;
};

export type ResolvedTableEconomics = {
  customerTanPercent: number;
  internalCostPercentApplied?: number;
  internalCostPercentAt24Months?: number;
  durationTermSnapshot?: DurationTermSnapshot;
  minimumAmount: number;
  maximumAmount: number;
};

/**
 * Risolve TAN, limiti importo e costo aziendale per la durata selezionata.
 * Con durationTerms: il termine è fonte di verità.
 */
export function resolveTableEconomicsForDuration(
  table: RuntimeFinancialTable,
  durationMonths: number,
): ResolvedTableEconomics | null {
  if (hasDurationTerms(table.durationTerms)) {
    const term = findDurationTerm(table.durationTerms, durationMonths);
    if (!term) {
      return null;
    }
    const customerTanPercent =
      term.customerTanPercent ?? table.customerTanPercent;
    const snapshot: DurationTermSnapshot = {
      durationMonths: term.durationMonths,
      minimumAmount: term.minimumAmount,
      maximumAmount: term.maximumAmount,
      customerTanPercent,
    };
    if (term.internalCostPercent !== undefined) {
      snapshot.internalCostPercent = term.internalCostPercent;
    }

    const resolved: ResolvedTableEconomics = {
      customerTanPercent,
      minimumAmount: term.minimumAmount,
      maximumAmount: term.maximumAmount,
      durationTermSnapshot: snapshot,
    };

    if (term.internalCostPercent !== undefined) {
      resolved.internalCostPercentApplied = term.internalCostPercent;
    } else if (table.internalCostPercentAt24Months !== undefined) {
      // LEGACY FALLBACK only if term does not specify exact cost
      resolved.internalCostPercentAt24Months =
        table.internalCostPercentAt24Months;
    }

    return resolved;
  }

  return {
    customerTanPercent: table.customerTanPercent,
    internalCostPercentAt24Months: table.internalCostPercentAt24Months,
    minimumAmount: table.minimumAmount,
    maximumAmount: table.maximumAmount,
  };
}

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
  const economics = resolveTableEconomicsForDuration(table, durationMonths);

  if (!economics) {
    reasons.push("Durata non prevista dalla tabella.");
  } else {
    if (requestedAmount < economics.minimumAmount) {
      reasons.push("Importo inferiore al minimo della tabella.");
    }
    if (requestedAmount > economics.maximumAmount) {
      reasons.push("Importo superiore al massimo della tabella.");
    }
  }

  const durations = resolveAllowedDurations(table);
  if (!durations.includes(durationMonths)) {
    if (!reasons.includes("Durata non prevista dalla tabella.")) {
      reasons.push("Durata non prevista dalla tabella.");
    }
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

function runFinancialCalculation(
  table: RuntimeFinancialTable,
  requestedAmount: number,
  durationMonths: number,
  delayDays: number,
): {
  calculation: FinancialCalculationResult;
  economics: ResolvedTableEconomics;
} {
  const economics = resolveTableEconomicsForDuration(table, durationMonths);
  if (!economics) {
    throw new Error("Durata non prevista dalla tabella.");
  }

  const calculation = calculateFinancialSolution({
    requestedAmount,
    durationMonths,
    customerTanPercent: economics.customerTanPercent,
    openingFeeType: table.openingFeeType,
    openingFeeValue: table.openingFeeValue,
    collectionFeePerInstallment: table.collectionFeePerInstallment,
    installmentFeeType: table.installmentFeeType,
    installmentFeeValue: table.installmentFeeValue,
    internalCostPercentApplied: economics.internalCostPercentApplied,
    internalCostPercentAt24Months: economics.internalCostPercentAt24Months,
    internalCostBase: table.internalCostBase,
    firstInstallmentDelayDays: delayDays,
  });

  return { calculation, economics };
}

export function collectAvailableDurations(
  tables: RuntimeFinancialTable[],
): number[] {
  const set = new Set<number>();
  for (const table of tables) {
    for (const duration of resolveAllowedDurations(table)) {
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
      const durations = resolveAllowedDurations(table);

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
          calculation = runFinancialCalculation(
            table,
            input.requestedAmount,
            duration,
            input.delayDays,
          ).calculation;
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
    let durationTermSnapshot: DurationTermSnapshot | undefined;
    let compatibility: CompatibilityEvaluation;

    if (technicalExclusionReasons.length > 0) {
      compatibility = emptyCompatibility(technicalExclusionReasons);
    } else {
      try {
        const ran = runFinancialCalculation(
          table,
          input.requestedAmount,
          selectedDurationMonths,
          delayDays,
        );
        calculation = ran.calculation;
        durationTermSnapshot = ran.economics.durationTermSnapshot;
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
      durationTermSnapshot,
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
  const durations = resolveAllowedDurations(input.table);

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
      const calculation = runFinancialCalculation(
        input.table,
        input.requestedAmount,
        durationMonths,
        input.delayDays,
      ).calculation;
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
