import type { ZeroInterestAlternativeAnalysis } from "../../../../shared/zero-interest-alternative";
import {
  getAlertSubtitle,
  getAlertTitle,
} from "../../../../shared/zero-interest-alternative";
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
  if (!analysis.enabled || !analysis.primary) return null;

  const primary = analysis.primary;
  const referenceType = primary.referenceType;

  return (
    <div
      data-testid="zero-interest-alternative-alert"
      className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{getAlertTitle(referenceType)}</p>
          <p className="text-sm">{getAlertSubtitle(referenceType)}</p>
          <p className="text-sm">
            Sconto equivalente:{" "}
            <span className="font-semibold tabular-nums">
              {formatDiscountPercent(primary.discountPercent)}
            </span>
          </p>
          <p className="text-sm text-sky-900/80">
            {primary.standardCompanyShortName} {primary.standardTableCode} ·{" "}
            {primary.durationMonths} mesi
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
