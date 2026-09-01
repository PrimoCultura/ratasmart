import { useState } from "react";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/common/LoadingState";
import {
  EMPLOYMENT_TYPE_LABELS,
  type EmploymentType,
} from "@/lib/constants/financial";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatting/currency";
import { HistoricalSolutionCard } from "./HistoricalSolutionCard";
import { ProposedSolutionBadge } from "./ProposedSolutionBadge";

type ComparisonBundle = {
  run: Doc<"simulationComparisonRuns"> & {
    isLatest: boolean;
    isHistorical: boolean;
  };
  solutions: Doc<"simulationComparisonSolutions">[];
  proposedSolutionId?: Id<"simulationComparisonSolutions">;
  proposedSolution: Doc<"simulationComparisonSolutions"> | null;
  inputsChangedAfterRun?: boolean;
};

type HistoricalComparisonViewProps = {
  bundle: ComparisonBundle | undefined | null;
  readOnly: boolean;
  hasExistingProposal: boolean;
  onPropose?: (solutionId: Id<"simulationComparisonSolutions">) => Promise<void>;
  onBackToLatest?: () => void;
  onChangeDuration?: (durationMonths: number) => void;
  showDurationSelector?: boolean;
  availableDurations?: number[];
  isRecalculatingDuration?: boolean;
};

export function HistoricalComparisonView({
  bundle,
  readOnly,
  hasExistingProposal,
  onPropose,
  onBackToLatest,
  onChangeDuration,
  showDurationSelector,
  availableDurations = [],
  isRecalculatingDuration,
}: HistoricalComparisonViewProps) {
  const [showIncompatible, setShowIncompatible] = useState(false);

  if (bundle === undefined) {
    return <LoadingState label="Caricamento confronto…" />;
  }

  if (bundle === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Nessun confronto ancora calcolato.
      </p>
    );
  }

  const { run, solutions, proposedSolutionId } = bundle;
  const patient = run.patientSnapshot;
  const compatible = solutions.filter((item) => item.resultGroup === "compatible");
  const verification = solutions.filter(
    (item) => item.resultGroup === "verification_required",
  );
  const incompatible = solutions.filter(
    (item) => item.resultGroup === "not_compatible",
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>
                  {run.isHistorical
                    ? `Confronto storico n. ${run.runNumber}`
                    : `Confronto n. ${run.runNumber}`}
                </CardTitle>
                {run.isLatest ? (
                  <Badge variant="secondary">Confronto attuale</Badge>
                ) : null}
                <Badge variant="outline">
                  Condizioni fotografate al momento del calcolo
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(run.calculationDate)} · Rete {run.network} ·{" "}
                {run.selectedDurationMonths} mesi · prima rata{" "}
                {run.selectedFirstInstallmentDelayDays} giorni
              </p>
            </div>
            {run.isHistorical && onBackToLatest ? (
              <Button type="button" variant="outline" onClick={onBackToLatest}>
                Torna al confronto attuale
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Importo" value={formatCurrency(run.requestedAmount)} />
            <Info
              label="Rata obiettivo"
              value={
                run.targetInstallment !== undefined
                  ? formatCurrency(run.targetInstallment)
                  : "Non indicata"
              }
            />
            <Info
              label="Paziente"
              value={`${patient.firstName} ${patient.lastName}, ${patient.age} anni`}
            />
            <Info
              label="Lavoro"
              value={
                EMPLOYMENT_TYPE_LABELS[patient.employmentType as EmploymentType] ??
                patient.employmentType
              }
            />
            <Info
              label="Extracomunitario"
              value={patient.isNonEuCitizen ? "Sì" : "No"}
            />
            {patient.temporaryContractExpiry !== undefined ? (
              <Info
                label="Scadenza contratto"
                value={formatDate(patient.temporaryContractExpiry)}
              />
            ) : null}
            {patient.residencePermitExpiry !== undefined ? (
              <Info
                label="Scadenza permesso"
                value={formatDate(patient.residencePermitExpiry)}
              />
            ) : null}
            <Info label="Motore finanziario" value={run.engineVersion} />
            <Info label="Motore policy" value={run.policyEngineVersion} />
          </div>

          {showDurationSelector &&
          !run.isHistorical &&
          onChangeDuration &&
          availableDurations.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">Durata confronto:</p>
              {availableDurations.map((duration) => (
                <Button
                  key={duration}
                  type="button"
                  size="sm"
                  variant={
                    duration === run.selectedDurationMonths
                      ? "default"
                      : "outline"
                  }
                  disabled={isRecalculatingDuration}
                  onClick={() => onChangeDuration(duration)}
                >
                  {duration} mesi
                </Button>
              ))}
            </div>
          ) : null}

          {bundle.proposedSolution ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <ProposedSolutionBadge />
              <span className="text-muted-foreground">
                {bundle.proposedSolution.companySnapshot.shortName} ·{" "}
                {bundle.proposedSolution.financialTableSnapshot.tableCode} ·{" "}
                {
                  bundle.proposedSolution.calculationInputSnapshot
                    .durationMonths
                }{" "}
                mesi
              </span>
            </div>
          ) : null}

          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {run.disclaimer}
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {run.fiscalWarning}
          </div>
          {run.warnings.map((warning) => (
            <div
              key={warning}
              className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
            >
              {warning}
            </div>
          ))}
        </CardContent>
      </Card>

      <SolutionSection
        title="Soluzioni compatibili con i requisiti formali"
        empty="Nessuna soluzione compatibile per questo confronto."
        solutions={compatible}
        proposedSolutionId={proposedSolutionId}
        hasExistingProposal={hasExistingProposal}
        readOnly={readOnly}
        onPropose={onPropose}
      />

      <SolutionSection
        title="Soluzioni che richiedono una verifica"
        empty="Nessuna soluzione in verifica per questo confronto."
        solutions={verification}
        proposedSolutionId={proposedSolutionId}
        hasExistingProposal={hasExistingProposal}
        readOnly={readOnly}
        onPropose={onPropose}
      />

      <section className="space-y-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowIncompatible((value) => !value)}
        >
          {showIncompatible
            ? "Nascondi soluzioni non compatibili"
            : "Mostra soluzioni non compatibili"}
        </Button>
        {showIncompatible ? (
          <SolutionSection
            title="Soluzioni non compatibili"
            empty="Nessuna soluzione non compatibile."
            solutions={incompatible}
            proposedSolutionId={proposedSolutionId}
            hasExistingProposal={hasExistingProposal}
            readOnly={readOnly}
            onPropose={onPropose}
          />
        ) : null}
      </section>
    </div>
  );
}

function SolutionSection({
  title,
  empty,
  solutions,
  proposedSolutionId,
  hasExistingProposal,
  readOnly,
  onPropose,
}: {
  title: string;
  empty: string;
  solutions: Doc<"simulationComparisonSolutions">[];
  proposedSolutionId?: Id<"simulationComparisonSolutions">;
  hasExistingProposal: boolean;
  readOnly: boolean;
  onPropose?: (solutionId: Id<"simulationComparisonSolutions">) => Promise<void>;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {solutions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        solutions.map((solution) => (
          <HistoricalSolutionCard
            key={solution._id}
            solution={solution}
            isProposed={proposedSolutionId === solution._id || solution.isProposed}
            hasExistingProposal={hasExistingProposal}
            readOnly={readOnly}
            onPropose={
              onPropose ? () => onPropose(solution._id) : undefined
            }
          />
        ))
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
