import type { RuntimeFinancialSolution } from "./types.ts";

function taegSortValue(solution: RuntimeFinancialSolution): number {
  const taeg = solution.calculation?.estimatedTaeg;
  if (!taeg || !taeg.success || taeg.taegPercent === null) {
    return Number.POSITIVE_INFINITY;
  }
  return taeg.taegPercent;
}

function installmentSortValue(solution: RuntimeFinancialSolution): number {
  return (
    solution.calculation?.regularTotalInstallmentAmount ??
    Number.POSITIVE_INFINITY
  );
}

/** Gruppo 1: senza costo/autorizzazione; Gruppo 2: con costo o alert autorizzazione. */
function hasCorporateCostOrAuthorization(
  solution: RuntimeFinancialSolution,
): boolean {
  return (
    (solution.calculation?.internalCostAmount ?? 0) > 0 ||
    solution.requiresManagerAuthorizationNotice
  );
}

function compareCompatibleWithinGroup(
  a: RuntimeFinancialSolution,
  b: RuntimeFinancialSolution,
): number {
  if (b.priorityScore !== a.priorityScore) {
    return b.priorityScore - a.priorityScore;
  }
  const installmentDiff = installmentSortValue(a) - installmentSortValue(b);
  if (installmentDiff !== 0) return installmentDiff;
  const taegDiff = taegSortValue(a) - taegSortValue(b);
  if (taegDiff !== 0) return taegDiff;
  const companyDiff = a.companyName.localeCompare(b.companyName, "it");
  if (companyDiff !== 0) return companyDiff;
  return a.tableCode.localeCompare(b.tableCode, "it");
}

/**
 * Ordina le soluzioni:
 * 1. compatible — prima senza costo/autorizzazione, poi con costo/autorizzazione;
 *    dentro ogni gruppo: priorità ↓, rata ↑, TAEG ↑, nome, codice
 * 2. verification_required (rata ↑, nome, codice) — senza priorità
 * 3. not_compatible (motivi ↑, nome, codice)
 *
 * NE9 (TAN 0 ma costo 0 e senza auth) resta nel gruppo 1.
 */
export function rankFinancialSolutions(
  solutions: RuntimeFinancialSolution[],
): RuntimeFinancialSolution[] {
  const compatible = solutions.filter(
    (item) => item.compatibility.status === "compatible",
  );

  const withoutCost = compatible
    .filter((item) => !hasCorporateCostOrAuthorization(item))
    .sort(compareCompatibleWithinGroup);

  const withCost = compatible
    .filter((item) => hasCorporateCostOrAuthorization(item))
    .sort(compareCompatibleWithinGroup);

  const verification = solutions
    .filter((item) => item.compatibility.status === "verification_required")
    .sort((a, b) => {
      const installmentDiff =
        installmentSortValue(a) - installmentSortValue(b);
      if (installmentDiff !== 0) return installmentDiff;
      const companyDiff = a.companyName.localeCompare(b.companyName, "it");
      if (companyDiff !== 0) return companyDiff;
      return a.tableCode.localeCompare(b.tableCode, "it");
    });

  const incompatible = solutions
    .filter((item) => item.compatibility.status === "not_compatible")
    .sort((a, b) => {
      const reasonsA =
        a.compatibility.reasons.length + a.technicalExclusionReasons.length;
      const reasonsB =
        b.compatibility.reasons.length + b.technicalExclusionReasons.length;
      if (reasonsA !== reasonsB) return reasonsA - reasonsB;
      const companyDiff = a.companyName.localeCompare(b.companyName, "it");
      if (companyDiff !== 0) return companyDiff;
      return a.tableCode.localeCompare(b.tableCode, "it");
    });

  return [...withoutCost, ...withCost, ...verification, ...incompatible];
}

export function findNearestTargetSolution(
  solutions: RuntimeFinancialSolution[],
  _targetInstallment: number,
): RuntimeFinancialSolution | undefined {
  const candidates = solutions.filter(
    (item) =>
      item.compatibility.status === "compatible" &&
      item.calculation !== null &&
      item.distanceFromTargetInstallment !== undefined,
  );

  if (candidates.length === 0) {
    return undefined;
  }

  return candidates.reduce((best, current) => {
    const bestDistance = Math.abs(best.distanceFromTargetInstallment ?? 0);
    const currentDistance = Math.abs(
      current.distanceFromTargetInstallment ?? 0,
    );
    if (currentDistance < bestDistance) {
      return current;
    }
    return best;
  });
}

export function formatTargetDistance(distance: number): string {
  const absolute = Math.abs(distance);
  const formatted = absolute.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (distance > 0) {
    return `€${formatted} sopra la rata obiettivo`;
  }
  if (distance < 0) {
    return `€${formatted} sotto la rata obiettivo`;
  }
  return "Allineata alla rata obiettivo";
}
