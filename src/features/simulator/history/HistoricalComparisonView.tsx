import { useEffect, useMemo, useState } from "react";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import {
  resolveComparisonDiagnostics,
  type ComparisonDiagnostics,
} from "../../../../shared/alternative-diagnostics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
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
  ComparisonSection,
} from "../comparison";
import { hasCompanyCostOrAuth } from "../comparison/solutionDisplay";
import { ComparisonDiagnosticsCard } from "./ComparisonDiagnosticsCard";
import { DocumentationRequirementsCard } from "./DocumentationRequirementsCard";
import { ProposedSolutionBadge } from "./ProposedSolutionBadge";
import { evaluateIncomeDocumentRequirements } from "../../../../shared/documentation-requirements";
import type { ZeroInterestAlternativeAnalysis } from "../../../../shared/zero-interest-alternative";
import { ZeroInterestAlternativeCard } from "./ZeroInterestAlternativeCard";
import { ZeroInterestAlternativeAlert } from "./ZeroInterestAlternativeAlert";

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

  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  useEffect(() => {
    setExpandedSolutionId(null);
    setShowIncompatible(false);
    setShowTechnicalDetails(false);
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
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-2 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">
                  {run.isHistorical
                    ? `Confronto storico n. ${run.runNumber}`
                    : `Confronto n. ${run.runNumber}`}
                  {" · "}
                  {run.selectedDurationMonths} mesi ·{" "}
                  {formatCurrency(run.requestedAmount)} · prima rata{" "}
                  {run.selectedFirstInstallmentDelayDays} gg
                </CardTitle>
                {run.isLatest ? (
                  <Badge variant="secondary">Attuale</Badge>
                ) : null}
                {run.isHistorical ? (
                  <Badge variant="outline">Storico</Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {EMPLOYMENT_TYPE_LABELS[patient.employmentType as EmploymentType] ??
                  patient.employmentType}
                {" · "}
                {patient.age} anni ·{" "}
                {patient.isNonEuCitizen ? "Extracomunitario" : "Italiano"}
                {run.targetInstallment !== undefined
                  ? ` · Rata obiettivo ${formatCurrency(run.targetInstallment)}`
                  : ""}
              </p>
            </div>
            {run.isHistorical && onBackToLatest ? (
              <Button type="button" variant="outline" size="sm" onClick={onBackToLatest}>
                Torna all&apos;attuale
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showDurationSelector &&
            !run.isHistorical &&
            onChangeDuration &&
            availableDurations.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">Durata confronto</p>
                <Select
                  value={String(run.selectedDurationMonths)}
                  disabled={isRecalculatingDuration}
                  onValueChange={(value) => onChangeDuration(Number(value))}
                >
                  <SelectTrigger className="h-8 w-[140px]">
                    <SelectValue placeholder="Durata" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDurations.map((duration) => (
                      <SelectItem key={duration} value={String(duration)}>
                        {duration} mesi
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
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
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            <p>ⓘ Compatibilità basata sui requisiti conosciuti.</p>
            <p>⚠ Bollo/imposta sostitutiva non inclusi.</p>
          </div>

          <button
            type="button"
            className="text-xs font-medium text-muted-foreground"
            aria-expanded={showTechnicalDetails}
            onClick={() => setShowTechnicalDetails((value) => !value)}
          >
            {showTechnicalDetails
              ? "Nascondi dettagli tecnici"
              : "Dettagli tecnici"}
          </button>
          {showTechnicalDetails ? (
            <div className="grid gap-2 rounded-md border px-3 py-2 text-xs text-muted-foreground sm:grid-cols-2">
              <p>Calcolato: {formatDateTime(run.calculationDate)}</p>
              <p>Rete: {run.network}</p>
              <p>Motore finanziario: {run.engineVersion}</p>
              <p>Motore policy: {run.policyEngineVersion}</p>
              {patient.temporaryContractExpiry !== undefined ? (
                <p>
                  Scadenza contratto: {formatDate(patient.temporaryContractExpiry)}
                </p>
              ) : null}
              {patient.residencePermitExpiry !== undefined ? (
                <p>
                  Scadenza permesso: {formatDate(patient.residencePermitExpiry)}
                </p>
              ) : null}
              <p className="sm:col-span-2">{run.disclaimer}</p>
              <p className="sm:col-span-2">{run.fiscalWarning}</p>
              {run.warnings.map((warning) => (
                <p key={warning} className="sm:col-span-2">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {zeroInterestAlternative ? (
          <ZeroInterestAlternativeAlert analysis={zeroInterestAlternative} />
        ) : null}

        <section className="space-y-3">
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

        <section className="space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
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
