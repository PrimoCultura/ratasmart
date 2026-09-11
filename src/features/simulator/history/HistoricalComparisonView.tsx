import { useEffect, useMemo, useState } from "react";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import {
  resolveComparisonDiagnostics,
  type ComparisonDiagnostics,
} from "../../../../shared/alternative-diagnostics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/common/LoadingState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EMPLOYMENT_TYPE_LABELS,
  type EmploymentType,
} from "@/lib/constants/financial";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatting/currency";
import {
  ComparisonHeader,
  ComparisonSection,
} from "../comparison";
import { hasCompanyCostOrAuth } from "../comparison/solutionDisplay";
import { ComparisonDiagnosticsCard } from "./ComparisonDiagnosticsCard";
import { DocumentationRequirementsCard } from "./DocumentationRequirementsCard";
import { ProposedSolutionBadge } from "./ProposedSolutionBadge";
import { evaluateIncomeDocumentRequirements } from "../../../../shared/documentation-requirements";
import type { ZeroInterestAlternativeAnalysis } from "../../../../shared/zero-interest-alternative";
import { ZeroInterestAlternativeCard } from "./ZeroInterestAlternativeCard";

type ComparisonBundle = {
  run: Doc<"simulationComparisonRuns"> & {
    isLatest: boolean;
    isHistorical: boolean;
    zeroInterestAlternativeSnapshot?: ZeroInterestAlternativeAnalysis;
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
  const [expandedSolutionId, setExpandedSolutionId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setExpandedSolutionId(null);
    setShowIncompatible(false);
  }, [bundle?.run._id]);

  const diagnostics = useMemo(() => {
    if (!bundle) return null;
    const { run, solutions } = bundle;
    const compatibleCount = solutions.filter(
      (item) => item.resultGroup === "compatible",
    ).length;
    const verificationCount = solutions.filter(
      (item) => item.resultGroup === "verification_required",
    ).length;
    if (compatibleCount > 0) return null;

    const patient = run.patientSnapshot;
    const persisted = (
      run as Doc<"simulationComparisonRuns"> & {
        diagnosticsSnapshot?: ComparisonDiagnostics;
      }
    ).diagnosticsSnapshot;

    return resolveComparisonDiagnostics({
      persistedDiagnostics: persisted,
      hasCompatibleSolutions: false,
      verificationRequiredCount: verificationCount,
      calculationDate: run.calculationDate,
      requestedAmount: run.requestedAmount,
      selectedDurationMonths: run.selectedDurationMonths,
      firstInstallmentDelayDays: run.selectedFirstInstallmentDelayDays,
      patient: {
        age: patient.age,
        employmentType: patient.employmentType,
        temporaryContractExpiry: patient.temporaryContractExpiry,
        isNonEuCitizen: patient.isNonEuCitizen,
        residencePermitExpiry: patient.residencePermitExpiry,
        hasResidencePermitRenewalReceiptOnly:
          patient.hasResidencePermitRenewalReceiptOnly,
        employmentStartDate: (
          patient as typeof patient & { employmentStartDate?: string }
        ).employmentStartDate,
        employmentSeniorityMonths: patient.employmentSeniorityMonths,
        hasGuarantor: patient.hasGuarantor,
      },
      solutions: solutions.map((item) => ({
        resultGroup: item.resultGroup,
        companyShortName: item.companySnapshot.shortName,
        compatibilitySnapshot: item.compatibilitySnapshot,
        technicalExclusionReasons: item.technicalExclusionReasons,
        openingFeeAmount: item.calculationSummary?.openingFeeAmount,
      })),
    });
  }, [bundle]);

  const documentationRequirements = useMemo(() => {
    if (!bundle) return null;
    const persisted = (
      bundle.run as Doc<"simulationComparisonRuns"> & {
        diagnosticsSnapshot?: ComparisonDiagnostics;
      }
    ).diagnosticsSnapshot?.documentationRequirements;
    if (persisted) return persisted;
    if (diagnostics?.documentationRequirements) {
      return diagnostics.documentationRequirements;
    }
    const maxFee = bundle.solutions.reduce((max, solution) => {
      const fee = solution.calculationSummary?.openingFeeAmount ?? 0;
      return fee > max ? fee : max;
    }, 0);
    return evaluateIncomeDocumentRequirements({
      requestedAmount: bundle.run.requestedAmount,
      financedFees: maxFee,
      isNonEuCitizen: bundle.run.patientSnapshot.isNonEuCitizen,
    });
  }, [bundle, diagnostics]);

  const zeroInterestAlternative = useMemo(() => {
    if (!bundle) return null;
    const snapshot = (
      bundle.run as Doc<"simulationComparisonRuns"> & {
        zeroInterestAlternativeSnapshot?: ZeroInterestAlternativeAnalysis;
      }
    ).zeroInterestAlternativeSnapshot;
    if (!snapshot?.enabled) return null;
    return snapshot;
  }, [bundle]);

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
  const isCurrentRun = !run.isHistorical;

  const compatible = solutions.filter((item) => item.resultGroup === "compatible");
  const compatibleWithoutCost = compatible.filter(
    (item) => !hasCompanyCostOrAuth(item),
  );
  const compatibleWithCost = compatible.filter((item) =>
    hasCompanyCostOrAuth(item),
  );
  const verification = solutions.filter(
    (item) => item.resultGroup === "verification_required",
  );
  const incompatible = solutions.filter(
    (item) => item.resultGroup === "not_compatible",
  );

  const handleToggleExpanded = (solutionId: string) => {
    setExpandedSolutionId((current) =>
      current === solutionId ? null : solutionId,
    );
  };

  const sectionShared = {
    proposedSolutionId,
    hasExistingProposal,
    readOnly,
    isCurrentRun,
    expandedSolutionId,
    onToggleExpanded: handleToggleExpanded,
    onPropose,
  } as const;

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
                {run.isHistorical ? (
                  <Badge variant="outline">
                    Condizioni fotografate al momento del calcolo
                  </Badge>
                ) : null}
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
            <Info label="Età paziente" value={`${patient.age} anni`} />
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
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">Durata confronto</p>
              <Select
                value={String(run.selectedDurationMonths)}
                disabled={isRecalculatingDuration}
                onValueChange={(value) => onChangeDuration(Number(value))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Seleziona durata" />
                </SelectTrigger>
                <SelectContent>
                  {availableDurations.map((duration) => (
                    <SelectItem key={duration} value={String(duration)}>
                      {duration} mesi
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <div className="space-y-4">
        <ComparisonHeader
          requestedAmount={run.requestedAmount}
          durationMonths={run.selectedDurationMonths}
          targetInstallment={run.targetInstallment}
        />

        <section className="space-y-4">
          <h2 className="sr-only">Soluzioni compatibili</h2>
          {compatible.length === 0 ? (
            diagnostics ? (
              <ComparisonDiagnosticsCard diagnostics={diagnostics} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Nessuna soluzione compatibile per questo confronto.
              </p>
            )
          ) : (
            <>
              {compatibleWithoutCost.length > 0 ? (
                <ComparisonSection
                  title="Senza costo aziendale"
                  description="Soluzioni da valutare per prime"
                  empty="Nessuna soluzione senza costo aziendale."
                  headingLevel="h3"
                  solutions={compatibleWithoutCost}
                  tone="default"
                  {...sectionShared}
                />
              ) : null}
              {compatibleWithCost.length > 0 ? (
                <ComparisonSection
                  title="Soluzioni con costo aziendale"
                  description="Richiedono autorizzazione del responsabile prima del caricamento pratica."
                  empty="Nessuna soluzione con costo aziendale."
                  headingLevel="h3"
                  solutions={compatibleWithCost}
                  tone="company_cost"
                  {...sectionShared}
                />
              ) : null}
            </>
          )}

          {documentationRequirements ? (
            <DocumentationRequirementsCard
              documentation={documentationRequirements}
            />
          ) : null}
        </section>

        {zeroInterestAlternative ? (
          <ZeroInterestAlternativeCard analysis={zeroInterestAlternative} />
        ) : null}

        {verification.length > 0 ? (
          <ComparisonSection
            title="Soluzioni che richiedono una verifica"
            empty="Nessuna soluzione in verifica per questo confronto."
            solutions={verification}
            tone="verification"
            {...sectionShared}
          />
        ) : null}

        <section className="space-y-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowIncompatible((value) => !value)}
            aria-expanded={showIncompatible}
          >
            {showIncompatible
              ? "Nascondi soluzioni non compatibili"
              : "Mostra soluzioni non compatibili"}
          </Button>
          {showIncompatible ? (
            <ComparisonSection
              title="Soluzioni non compatibili"
              empty="Nessuna soluzione non compatibile."
              solutions={incompatible}
              tone="incompatible"
              grid={false}
              {...sectionShared}
            />
          ) : null}
        </section>
      </div>
    </div>
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
