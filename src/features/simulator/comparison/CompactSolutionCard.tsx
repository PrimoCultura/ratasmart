import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatPercent } from "@/lib/formatting/financial";
import { CompatibilityBadge } from "./CompatibilityBadge";
import { CompanyCostAlert } from "./CompanyCostAlert";
import { ExpandedSolutionDetails } from "./ExpandedSolutionDetails";
import {
  primaryIncompatibilityReason,
  primaryVerificationReason,
  solutionCategoryLabel,
  type ComparisonSolution,
} from "./solutionDisplay";

export type CompactCardTone =
  | "default"
  | "company_cost"
  | "verification"
  | "incompatible";

type CompactSolutionCardProps = {
  solution: ComparisonSolution;
  isProposed: boolean;
  hasExistingProposal: boolean;
  readOnly: boolean;
  isCurrentRun: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  tone?: CompactCardTone;
  onPropose?: () => Promise<void>;
};

export function CompactSolutionCard({
  solution,
  isProposed,
  hasExistingProposal,
  readOnly,
  isCurrentRun,
  isExpanded,
  onToggleExpanded,
  tone = "default",
  onPropose,
}: CompactSolutionCardProps) {
  const calc = solution.calculationSummary;
  const table = solution.financialTableSnapshot;
  const company = solution.companySnapshot.shortName;
  const tableCode = table.tableCode;
  const categoryLabel = solutionCategoryLabel(solution);
  const detailsId = `solution-details-${solution._id}`;

  if (tone === "incompatible") {
    return (
      <Card className="border-border/80 bg-muted/20 shadow-none">
        <CardContent className="space-y-2 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">
                {company} · {tableCode}
              </p>
              <p className="text-xs text-muted-foreground">{categoryLabel}</p>
            </div>
            <CompatibilityBadge status="not_compatible" />
          </div>
          <p className="text-xs text-destructive">
            {primaryIncompatibilityReason(solution)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            onClick={onToggleExpanded}
          >
            {isExpanded ? "Nascondi" : "Dettagli"}
            <ChevronDown
              className={cn(
                "ml-1 h-3.5 w-3.5 transition-transform",
                isExpanded && "rotate-180",
              )}
              aria-hidden
            />
          </Button>
          {isExpanded ? (
            <div id={detailsId}>
              <ExpandedSolutionDetails
                solution={solution}
                isProposed={isProposed}
                hasExistingProposal={hasExistingProposal}
                readOnly={readOnly}
                isCurrentRun={isCurrentRun}
                onPropose={onPropose}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const toneClass =
    tone === "company_cost"
      ? "border-red-300/80 bg-red-50/40"
      : tone === "verification"
        ? "border-amber-300/70 bg-amber-50/30"
        : "border-border bg-card";

  return (
    <Card className={cn("shadow-sm", toneClass)}>
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight tracking-tight">
              {company} · {tableCode}
            </p>
            <p className="text-xs text-muted-foreground">{categoryLabel}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <CompatibilityBadge
              status={solution.compatibilitySnapshot.status}
            />
            {solution.prioritySnapshot.isCompanyPriority ? (
              <Badge variant="secondary">Priorità aziendale</Badge>
            ) : null}
            {isProposed ? (
              <Badge variant="success">Soluzione proposta</Badge>
            ) : null}
            {tone === "company_cost" ? (
              <Badge
                className="border-red-200 bg-red-100 text-red-900"
                variant="outline"
              >
                RICHIEDE AUTORIZZAZIONE
              </Badge>
            ) : null}
          </div>
        </div>

        {calc ? (
          <>
            <div>
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                {formatCurrency(calc.regularTotalInstallmentAmount)}
                <span className="ml-1 text-sm font-medium text-muted-foreground">
                  / mese
                </span>
              </p>
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground/80">
                {calc.durationMonths} mesi
              </p>
              <p>
                TAN {formatPercent(calc.customerTanPercent)}
                {" · "}
                TAEG{" "}
                {calc.taegCalculationSucceeded && calc.taegPercent !== undefined
                  ? formatPercent(calc.taegPercent)
                  : "n/d"}
              </p>
              <p>
                Totale paziente{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(calc.totalCustomerRepayment)}
                </span>
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Calcolo non disponibile per questa tabella.
          </p>
        )}

        {tone === "company_cost" && calc ? (
          <CompanyCostAlert
            internalCostAmount={calc.internalCostAmount}
          />
        ) : null}

        {tone === "verification" ? (
          <p className="text-xs text-amber-900">
            {primaryVerificationReason(solution)}
          </p>
        ) : null}

        <div className="mt-auto pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            onClick={onToggleExpanded}
          >
            {isExpanded ? "Nascondi dettagli" : "Dettagli"}
            <ChevronDown
              className={cn(
                "ml-1.5 h-4 w-4 transition-transform",
                isExpanded && "rotate-180",
              )}
              aria-hidden
            />
          </Button>
        </div>

        {isExpanded ? (
          <div id={detailsId}>
            <ExpandedSolutionDetails
              solution={solution}
              isProposed={isProposed}
              hasExistingProposal={hasExistingProposal}
              readOnly={readOnly}
              isCurrentRun={isCurrentRun}
              onPropose={onPropose}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
