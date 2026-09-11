import { useState, type ReactNode } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { formatTargetDistance } from "../../../../shared/policy-engine/ranking";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatting/currency";
import {
  formatInstallmentFee,
  formatPercent,
} from "@/lib/formatting/financial";
import { ManagerAuthorizationAlert } from "../components/ManagerAuthorizationAlert";
import {
  InternalMessageDialog,
  type ProtectedInternalMessage,
} from "../components/InternalMessageDialog";
import { HistoricalAmortization } from "../history/HistoricalAmortization";
import { ProposedSolutionBadge } from "../history/ProposedSolutionBadge";
import { SelectProposedSolutionDialog } from "../history/SelectProposedSolutionDialog";
import { CompatibilityBadge } from "./CompatibilityBadge";
import type { ComparisonSolution } from "./solutionDisplay";

type ExpandedSolutionDetailsProps = {
  solution: ComparisonSolution;
  isProposed: boolean;
  hasExistingProposal: boolean;
  readOnly: boolean;
  /** false = run storico (label audit); true = confronto operativo corrente */
  isCurrentRun: boolean;
  onPropose?: () => Promise<void>;
};

export function ExpandedSolutionDetails({
  solution,
  isProposed,
  hasExistingProposal,
  readOnly,
  isCurrentRun,
  onPropose,
}: ExpandedSolutionDetailsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isProposing, setIsProposing] = useState(false);

  const calc = solution.calculationSummary;
  const table = solution.financialTableSnapshot;

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

  const companySectionTitle = isCurrentRun
    ? "Condizioni aziendali"
    : "Condizioni fotografate al momento del calcolo";
  const compatibilitySectionTitle = isCurrentRun
    ? "Compatibilità"
    : "Compatibilità fotografata";

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
    <div className="space-y-4 border-t border-border pt-4 text-sm">
      {messages.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {messages.map((message) => (
            <InternalMessageDialog key={message.id} message={message} />
          ))}
        </div>
      ) : null}

      {calc ? (
        <>
          <DetailSection title="Paziente / finanziamento">
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
              <Info
                label="Interessi"
                value={formatCurrency(calc.totalCustomerInterest)}
              />
              <Info
                label="Costi complessivi"
                value={formatCurrency(calc.totalCustomerCosts)}
              />
              <Info
                label="Totale dovuto"
                value={formatCurrency(calc.totalCustomerRepayment)}
              />
            </div>
          </DetailSection>

          <DetailSection title="Condizioni">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                label="Spesa/commissione per rata"
                value={formatInstallmentFee(
                  calc.installmentFeeType ?? table.installmentFeeType,
                  calc.installmentFeeValue ?? table.installmentFeeValue,
                  calc.collectionFeePerInstallment,
                )}
              />
              <Info
                label="Rata totale"
                value={formatCurrency(calc.regularTotalInstallmentAmount)}
              />
              <Info
                label="Ultima rata"
                value={formatCurrency(calc.finalTotalInstallmentAmount)}
              />
            </div>
            {solution.distanceFromTargetInstallment !== undefined ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {formatTargetDistance(solution.distanceFromTargetInstallment)}
              </p>
            ) : null}
          </DetailSection>

          <DetailSection title={companySectionTitle}>
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
          </DetailSection>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Calcolo non eseguito: condizioni tecniche della tabella non
          soddisfatte.
        </p>
      )}

      <DetailSection title={compatibilitySectionTitle}>
        <div className="mb-2">
          <CompatibilityBadge status={solution.compatibilitySnapshot.status} />
        </div>
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
      </DetailSection>

      {solution.requiresManagerAuthorizationNotice ? (
        <ManagerAuthorizationAlert />
      ) : null}

      <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
        Alla prima rata potrà essere aggiunto l’onere fiscale previsto dalla
        normativa applicabile.
      </div>

      <DetailSection title="Azioni">
        {isProposed ? (
          <div className="mb-2">
            <ProposedSolutionBadge />
          </div>
        ) : null}
        <HistoricalAmortization
          solutionId={solution._id as Id<"simulationComparisonSolutions">}
          hasCalculationSummary={calc !== undefined}
        />
        {canPropose ? (
          <div className="mt-2 space-y-2">
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
          </div>
        ) : null}
      </DetailSection>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
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
