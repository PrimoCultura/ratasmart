import type { ZeroInterestAlternativeAnalysis } from "../../../../shared/zero-interest-alternative";
import { Button } from "@/components/ui/button";

export const ZERO_INTEREST_ALTERNATIVE_ANCHOR_ID = "zero-interest-alternative";

type ZeroInterestAlternativeAlertProps = {
  analysis: ZeroInterestAlternativeAnalysis;
};

function formatDiscountPercent(value: number): string {
  return `${value.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

export function scrollToZeroInterestAlternativeCard() {
  const node = document.getElementById(ZERO_INTEREST_ALTERNATIVE_ANCHOR_ID);
  node?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ZeroInterestAlternativeAlert({
  analysis,
}: ZeroInterestAlternativeAlertProps) {
  if (!analysis.enabled) return null;

  if (!analysis.primary) {
    if (analysis.messages.length === 0) return null;
    return (
      <div
        data-testid="zero-interest-alternative-alert"
        className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
      >
        {analysis.messages[0]}
      </div>
    );
  }

  const primary = analysis.primary;

  return (
    <div
      data-testid="zero-interest-alternative-alert"
      className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5 text-sky-950"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5 text-sm">
          <p className="font-semibold">Richiesta tasso zero</p>
          <p>Alternativa commerciale disponibile</p>
          <p>
            <span className="font-medium">
              {primary.standardCompanyShortName} {primary.standardTableCode}
            </span>
            {" · "}
            {primary.durationMonths} mesi
            {" · "}
            Sconto equivalente:{" "}
            <span className="font-semibold tabular-nums">
              {formatDiscountPercent(primary.discountPercent)}
            </span>
          </p>
          <p className="text-sky-900/80">
            Totale paziente praticamente equivalente al tasso zero{" "}
            {primary.zeroCompanyShortName} {primary.zeroTableCode}.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="zero-interest-alternative-see-comparison"
          onClick={scrollToZeroInterestAlternativeCard}
        >
          Vedi confronto
        </Button>
      </div>
    </div>
  );
}
