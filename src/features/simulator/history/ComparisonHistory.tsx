import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [open, setOpen] = useState(true);

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <CardTitle className="text-base">Cronologia confronti</CardTitle>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
        </button>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-2">
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
