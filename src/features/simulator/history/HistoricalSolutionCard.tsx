import { useState } from "react";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { formatTargetDistance } from "../../../../shared/policy-engine/ranking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCT_CATEGORY_LABELS } from "@/lib/constants/financial";
import type { ProductCategory } from "@/lib/constants/financial";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatPercent } from "@/lib/formatting/financial";
import { ManagerAuthorizationAlert } from "../components/ManagerAuthorizationAlert";
import {
  InternalMessageDialog,
  type ProtectedInternalMessage,
} from "../components/InternalMessageDialog";
import { HistoricalAmortization } from "./HistoricalAmortization";
import { ProposedSolutionBadge } from "./ProposedSolutionBadge";
import { SelectProposedSolutionDialog } from "./SelectProposedSolutionDialog";

type HistoricalSolutionCardProps = {
  solution: Doc<"simulationComparisonSolutions">;
  isProposed: boolean;
  hasExistingProposal: boolean;
  readOnly: boolean;
  onPropose?: () => Promise<void>;
};

function statusLabel(
  status: Doc<"simulationComparisonSolutions">["compatibilitySnapshot"]["status"],
) {
  switch (status) {
    case "compatible":
      return "Compatibile (requisiti formali)";
    case "verification_required":
      return "Da verificare";
    case "not_compatible":
      return "Non compatibile";
  }
}

function statusVariant(
  status: Doc<"simulationComparisonSolutions">["compatibilitySnapshot"]["status"],
): "success" | "warning" | "outline" {
  if (status === "compatible") return "success";
  if (status === "verification_required") return "warning";
  return "outline";
}

export function HistoricalSolutionCard({
  solution,
  isProposed,
  hasExistingProposal,
  readOnly,
  onPropose,
}: HistoricalSolutionCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isProposing, setIsProposing] = useState(false);

  const calc = solution.calculationSummary;
  const table = solution.financialTableSnapshot;
  const categoryLabel =
    PRODUCT_CATEGORY_LABELS[solution.productSnapshot.category as ProductCategory] ??
    solution.productSnapshot.category;

  const canPropose =
    !readOnly &&
    solution.resultGroup === "compatible" &&
    calc !== undefined &&
    !isProposed &&
    onPropose !== undefined;

  const messages: ProtectedInternalMessage[] =
    solution.internalMessagesSnapshot.map((item) => ({
      id: item.originalMessageId,
      title: item.title || "Messaggio interno",
      message: item.message,
      messageType: item.messageType as ProtectedInternalMessage["messageType"],
      iconType: item.iconType as ProtectedInternalMessage["iconType"],
      requiresPrivacyConfirmation: item.requiresPrivacyConfirmation,
    }));

  const handleConfirmPropose = async () => {
    if (!onPropose) return;
    setIsProposing(true);
    try {
      await onPropose();
      setDialogOpen(false);
    } finally {
      setIsProposing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              {solution.companySnapshot.shortName} ·{" "}
              {solution.productSnapshot.name}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {table.tableCode} · v{table.version} · {categoryLabel} ·{" "}
              {table.network}
              {solution.productSnapshot.code
                ? ` · ${solution.productSnapshot.code}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(solution.compatibilitySnapshot.status)}>
              {statusLabel(solution.compatibilitySnapshot.status)}
            </Badge>
            {solution.prioritySnapshot.isCompanyPriority ? (
              <Badge variant="success">
                {solution.prioritySnapshot.label?.trim() ||
                  "Soluzione prioritaria aziendale"}
              </Badge>
            ) : null}
            {isProposed ? <ProposedSolutionBadge /> : null}
            {messages.map((message) => (
              <InternalMessageDialog key={message.id} message={message} />
            ))}
          </div>
        </div>
        {solution.prioritySnapshot.visibleReason &&
        solution.prioritySnapshot.isCompanyPriority ? (
          <p className="text-xs text-muted-foreground">
            {solution.prioritySnapshot.visibleReason}
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {calc ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Info
                label="Importo richiesto"
                value={formatCurrency(
                  solution.calculationInputSnapshot.requestedAmount,
                )}
              />
              <Info
                label="Commissione apertura"
                value={formatCurrency(calc.openingFeeAmount)}
              />
              <Info
                label="Importo finanziato"
                value={formatCurrency(calc.financedAmount)}
              />
              <Info label="Durata" value={`${calc.durationMonths} mesi`} />
              <Info
                label="Prima rata"
                value={`${calc.firstInstallmentDelayDays} giorni`}
              />
              <Info label="TAN" value={formatPercent(calc.customerTanPercent)} />
              <Info
                label="TAEG tecnico stimato"
                value={
                  calc.taegCalculationSucceeded && calc.taegPercent !== undefined
                    ? formatPercent(calc.taegPercent)
                    : "Non calcolabile"
                }
              />
              <Info
                label="Rata base"
                value={formatCurrency(calc.regularBaseInstallmentAmount)}
              />
              <Info
                label="Spesa incasso"
                value={formatCurrency(calc.collectionFeePerInstallment)}
              />
              <Info
                label="Rata totale"
                value={formatCurrency(calc.regularTotalInstallmentAmount)}
              />
              <Info
                label="Ultima rata"
                value={formatCurrency(calc.finalTotalInstallmentAmount)}
              />
              <Info
                label="Totale dovuto"
                value={formatCurrency(calc.totalCustomerRepayment)}
              />
              <Info
                label="Interessi"
                value={formatCurrency(calc.totalCustomerInterest)}
              />
              <Info
                label="Costi complessivi"
                value={formatCurrency(calc.totalCustomerCosts)}
              />
            </div>

            {solution.distanceFromTargetInstallment !== undefined ? (
              <p className="text-xs text-muted-foreground">
                {formatTargetDistance(solution.distanceFromTargetInstallment)}
              </p>
            ) : null}

            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Condizioni aziendali fotografate
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Info
                  label="Costo aziendale"
                  value={formatCurrency(calc.internalCostAmount)}
                />
                <Info
                  label="% costo applicata"
                  value={formatPercent(calc.internalCostPercentApplied)}
                />
                <Info
                  label={`Netto liquidato a ${table.network}`}
                  value={formatCurrency(calc.netAmountPaidToCompany)}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Calcolo non eseguito: condizioni tecniche della tabella non
            soddisfatte.
          </p>
        )}

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Compatibilità fotografata
          </p>
          {solution.compatibilitySnapshot.failedRules.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4 text-xs text-destructive">
              {solution.compatibilitySnapshot.failedRules.map((rule) => (
                <li key={rule.ruleId}>
                  {rule.message ?? rule.technicalReason ?? rule.ruleType}
                </li>
              ))}
            </ul>
          ) : null}
          {solution.compatibilitySnapshot.reasons.map((reason) => (
            <p key={reason} className="text-xs text-destructive">
              {reason}
            </p>
          ))}
          {solution.technicalExclusionReasons.map((reason) => (
            <p key={reason} className="text-xs text-destructive">
              {reason}
            </p>
          ))}
          {solution.compatibilitySnapshot.verificationRules.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4 text-xs text-amber-800">
              {solution.compatibilitySnapshot.verificationRules.map((rule) => (
                <li key={rule.ruleId}>
                  {rule.message ?? rule.technicalReason ?? rule.ruleType}
                </li>
              ))}
            </ul>
          ) : null}
          {solution.compatibilitySnapshot.verificationReasons.map((reason) => (
            <p key={reason} className="text-xs text-amber-800">
              {reason}
            </p>
          ))}
          {solution.compatibilitySnapshot.status === "compatible" ? (
            <p className="text-xs text-muted-foreground">
              Tutte le regole formali applicabili risultano rispettate.
            </p>
          ) : null}
        </div>

        {solution.requiresManagerAuthorizationNotice ? (
          <ManagerAuthorizationAlert />
        ) : null}

        <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
          Alla prima rata potrà essere aggiunto l’onere fiscale previsto dalla
          normativa applicabile.
        </div>

        <HistoricalAmortization
          solutionId={solution._id}
          hasCalculationSummary={calc !== undefined}
        />

        {canPropose ? (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => setDialogOpen(true)}
              disabled={isProposing}
            >
              Segna come soluzione proposta
            </Button>
            <SelectProposedSolutionDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              onConfirm={() => void handleConfirmPropose()}
              isLoading={isProposing}
              hasExistingProposal={hasExistingProposal}
            />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
