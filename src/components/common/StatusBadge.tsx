import { Badge } from "@/components/ui/badge";
import type { SimulationStatus } from "@/lib/constants/app";

const LABELS: Record<SimulationStatus, string> = {
  draft: "Bozza",
  proposed: "Proposta",
};

export type ComparisonStatus =
  | "not_started"
  | "calculated"
  | "solution_selected";

type StatusBadgeProps = {
  status: SimulationStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant={status === "proposed" ? "success" : "warning"}>
      {LABELS[status]}
    </Badge>
  );
}

type ComparisonStatusBadgeProps = {
  comparisonStatus?: ComparisonStatus | null;
  simulationStatus?: SimulationStatus;
};

/**
 * Bozza / Calcolata / Proposta — maps comparisonStatus with simulation.status.
 */
export function ComparisonStatusBadge({
  comparisonStatus,
  simulationStatus,
}: ComparisonStatusBadgeProps) {
  if (
    simulationStatus === "proposed" ||
    comparisonStatus === "solution_selected"
  ) {
    return <Badge variant="success">Proposta</Badge>;
  }
  if (comparisonStatus === "calculated") {
    return <Badge variant="secondary">Calcolata</Badge>;
  }
  return <Badge variant="warning">Bozza</Badge>;
}
