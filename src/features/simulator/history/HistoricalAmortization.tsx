import { useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatting/currency";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";

type AmortizationRow = {
  installmentNumber: number;
  dueOffsetMonths: number;
  openingBalance: number;
  principalAmount: number;
  interestAmount: number;
  collectionFeeAmount: number;
  totalInstallmentAmount: number;
  closingBalance: number;
};

type HistoricalAmortizationProps = {
  solutionId: Id<"simulationComparisonSolutions">;
  hasCalculationSummary: boolean;
};

export function HistoricalAmortization({
  solutionId,
  hasCalculationSummary,
}: HistoricalAmortizationProps) {
  const { userId } = useCurrentUser();
  const regenerate = useAction(
    api.comparison.regenerateAmortizationScheduleFromSnapshot,
  );

  const [showSchedule, setShowSchedule] = useState(false);
  const [schedule, setSchedule] = useState<AmortizationRow[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (showSchedule) {
      setShowSchedule(false);
      return;
    }
    if (schedule) {
      setShowSchedule(true);
      return;
    }
    if (!userId || !hasCalculationSummary) {
      toast.error("Piano di ammortamento non disponibile per questa soluzione.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await regenerate({
        currentUserId: userId,
        solutionId,
      });
      setSchedule(result.amortizationSchedule);
      setWarnings(result.warnings);
      setShowSchedule(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossibile rigenerare il piano di ammortamento.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasCalculationSummary) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isLoading}
        onClick={() => void handleToggle()}
      >
        {isLoading
          ? "Rigenerazione in corso…"
          : showSchedule
            ? "Nascondi piano di ammortamento"
            : "Mostra piano di ammortamento"}
      </Button>
      {showSchedule && schedule ? (
        <div className="space-y-2 overflow-x-auto">
          <p className="text-xs text-muted-foreground">
            Piano rigenerato utilizzando le condizioni fotografate nel confronto.
          </p>
          {warnings.map((warning) => (
            <div
              key={warning}
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              {warning}
            </div>
          ))}
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1 pr-2">N.</th>
                <th className="py-1 pr-2">Scadenza (mesi)</th>
                <th className="py-1 pr-2">Capitale iniziale</th>
                <th className="py-1 pr-2">Quota capitale</th>
                <th className="py-1 pr-2">Quota interessi</th>
                <th className="py-1 pr-2">Spesa incasso</th>
                <th className="py-1 pr-2">Rata totale</th>
                <th className="py-1">Capitale residuo</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row) => (
                <tr key={row.installmentNumber} className="border-b">
                  <td className="py-1 pr-2">{row.installmentNumber}</td>
                  <td className="py-1 pr-2">{row.dueOffsetMonths}</td>
                  <td className="py-1 pr-2">
                    {formatCurrency(row.openingBalance)}
                  </td>
                  <td className="py-1 pr-2">
                    {formatCurrency(row.principalAmount)}
                  </td>
                  <td className="py-1 pr-2">
                    {formatCurrency(row.interestAmount)}
                  </td>
                  <td className="py-1 pr-2">
                    {formatCurrency(row.collectionFeeAmount)}
                  </td>
                  <td className="py-1 pr-2">
                    {formatCurrency(row.totalInstallmentAmount)}
                  </td>
                  <td className="py-1">
                    {formatCurrency(row.closingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
