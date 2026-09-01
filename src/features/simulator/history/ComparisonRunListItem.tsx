import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/formatting/currency";
import type { ComparisonRunListItem } from "./ComparisonHistory";

type ComparisonRunListItemProps = {
  run: ComparisonRunListItem;
  isSelected: boolean;
  onOpen: () => void;
};

function sourceLabel(source: ComparisonRunListItem["source"]): string {
  return source === "manual_recalculation"
    ? "Ricalcolo manuale"
    : "Primo calcolo";
}

export function ComparisonRunListItemView({
  run,
  isSelected,
  onOpen,
}: ComparisonRunListItemProps) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${
        isSelected
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card"
      }`}
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">Confronto n. {run.runNumber}</p>
          {run.isLatest ? (
            <Badge variant="secondary">Confronto attuale</Badge>
          ) : null}
          {run.containsProposedSolution ? (
            <Badge variant="success">Contiene la proposta attiva</Badge>
          ) : null}
          <Badge variant="outline">{sourceLabel(run.source)}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(run.calculationDate)} ·{" "}
          {formatCurrency(run.requestedAmount)} · {run.selectedDurationMonths}{" "}
          mesi · prima rata {run.selectedFirstInstallmentDelayDays} gg ·{" "}
          {run.compatibleSolutionsCount} compatibili ·{" "}
          {run.verificationRequiredSolutionsCount} da verificare ·{" "}
          {run.incompatibleSolutionsCount} non compatibili
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant={isSelected ? "default" : "outline"}
        onClick={onOpen}
      >
        Apri confronto
      </Button>
    </div>
  );
}
