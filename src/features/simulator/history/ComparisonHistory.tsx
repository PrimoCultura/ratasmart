import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/common/LoadingState";
import { ComparisonRunListItemView } from "./ComparisonRunListItem";

export type ComparisonRunListItem = Doc<"simulationComparisonRuns"> & {
  isLatest: boolean;
  containsProposedSolution: boolean;
};

type ComparisonHistoryProps = {
  runs: ComparisonRunListItem[] | undefined;
  selectedRunId?: Id<"simulationComparisonRuns"> | null;
  onOpenRun: (runId: Id<"simulationComparisonRuns">) => void;
  errorMessage?: string | null;
};

export function ComparisonHistory({
  runs,
  selectedRunId,
  onOpenRun,
  errorMessage,
}: ComparisonHistoryProps) {
  const [open, setOpen] = useState(false);
  const count = runs?.length ?? 0;

  return (
    <Card data-testid="comparison-history" data-collapsed={open ? "false" : "true"}>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium"
          aria-expanded={open}
          data-testid="comparison-history-toggle"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span>
            Cronologia confronti{count > 0 ? ` (${count})` : ""}
          </span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Chiudi" : "Apri"}
        </Button>
      </div>
      {open ? (
        <CardContent className="space-y-2 border-t pt-3">
          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : runs === undefined ? (
            <LoadingState label="Caricamento cronologia…" />
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessun confronto ancora calcolato.
            </p>
          ) : (
            runs.map((run) => (
              <ComparisonRunListItemView
                key={run._id}
                run={run}
                isSelected={selectedRunId === run._id}
                onOpen={() => onOpenRun(run._id)}
              />
            ))
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
