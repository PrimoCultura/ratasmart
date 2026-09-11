import type { ReactNode } from "react";
import type { ZeroInterestAlternativeAnalysis } from "../../../../shared/zero-interest-alternative";
import {
  formatPatientTotalDifferenceCopy,
  getAnalysisCardSubtitle,
  getAnalysisCardTitle,
  getNetToCompanyReferenceLabel,
  getPrimaryProductHeadline,
  getReferenceSectionTitle,
} from "../../../../shared/zero-interest-alternative";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatting/currency";
import { ZERO_INTEREST_ALTERNATIVE_ANCHOR_ID } from "./ZeroInterestAlternativeAlert";

type ZeroInterestAlternativeCardProps = {
  analysis: ZeroInterestAlternativeAnalysis;
};

const BREAK_EVEN_EXPLANATION =
  "Indica la percentuale di remunerazione sul fatturato oltre la quale, considerando esclusivamente queste componenti, la soluzione standard+sconto compenserebbe il minor netto finanziario.";

function formatDiscountPercent(value: number): string {
  return `${value.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function SideBlock({
  title,
  children,
  emphasized,
}: {
  title: string;
  children: ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div
      className={
        emphasized
          ? "space-y-3 rounded-md border-2 border-sky-300 bg-sky-50/60 px-3 py-3"
          : "space-y-2 rounded-md border border-border bg-background px-3 py-3"
      }
    >
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  title,
  emphasize,
}: {
  label: string;
  value: string;
  title?: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground" title={title}>
        {label}
      </dt>
      <dd
        className={
          emphasize
            ? "text-right text-base font-semibold tabular-nums"
            : "text-right font-medium tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function ZeroInterestAlternativeCard({
  analysis,
}: ZeroInterestAlternativeCardProps) {
  if (!analysis.enabled) return null;

  const primary = analysis.primary;
  const referenceType =
    primary?.referenceType ?? analysis.primaryReferenceType ?? "zero_interest";
  const patientDiff = primary
    ? formatPatientTotalDifferenceCopy(primary.patientTotalDifferenceEuro)
    : null;

  return (
    <Card
      id={ZERO_INTEREST_ALTERNATIVE_ANCHOR_ID}
      data-testid="zero-interest-alternative-card"
      className="scroll-mt-4"
    >
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">
          {getAnalysisCardTitle(referenceType)}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {getAnalysisCardSubtitle(referenceType)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {analysis.messages.map((message) => (
          <p
            key={message}
            className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          >
            {message}
          </p>
        ))}

        {primary ? (
          <>
            <p className="text-sm font-medium">Alternativa commerciale</p>

            <div className="grid gap-3 md:grid-cols-2">
              <SideBlock title={getReferenceSectionTitle(primary.referenceType)}>
                <div className="space-y-1">
                  <p className="text-lg font-semibold tracking-tight">
                    {primary.zeroCompanyShortName} {primary.zeroTableCode}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {primary.durationMonths} mesi
                  </p>
                  {primary.referenceType === "subsidized" ? (
                    <p className="text-sm text-muted-foreground">
                      TAN {formatDiscountPercent(primary.referenceCustomerTanPercent)}
                    </p>
                  ) : null}
                </div>
                <dl className="space-y-1.5 text-sm">
                  <Row
                    label="Piano di cura"
                    value={formatCurrency(primary.zeroRateRequestedAmount)}
                  />
                  <Row
                    label="Rata"
                    value={formatCurrency(primary.zeroRateInstallment)}
                  />
                  <Row
                    label="Totale restituito dal paziente"
                    value={formatCurrency(primary.zeroRatePatientTotal)}
                  />
                  <Row
                    label="Commissione finanziata"
                    value={formatCurrency(primary.zeroRateOpeningFeeAmount)}
                  />
                  <Row
                    label="Importo finanziato"
                    value={formatCurrency(primary.zeroRateFinancedAmount)}
                  />
                  <Row
                    label="Costo azienda"
                    value={formatCurrency(primary.zeroRateCompanyCostEuro)}
                  />
                  <Row
                    label="Netto alla società"
                    value={formatCurrency(primary.zeroRateNetToCompanyEuro)}
                  />
                </dl>
              </SideBlock>

              <SideBlock title="Proposta standard da utilizzare" emphasized>
                <div className="space-y-1" data-testid="standard-proposal-headline">
                  <p className="text-lg font-semibold tracking-tight">
                    {getPrimaryProductHeadline(primary)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {primary.durationMonths} mesi
                  </p>
                </div>
                <dl className="space-y-2 text-sm">
                  <Row
                    label="Sconto equivalente"
                    value={formatDiscountPercent(primary.discountPercent)}
                    emphasize
                  />
                  <Row
                    label="Nuovo piano"
                    value={formatCurrency(primary.discountedAmount)}
                    emphasize
                  />
                  <Row
                    label="Rata"
                    value={formatCurrency(primary.standardInstallment)}
                    emphasize
                  />
                  <Row
                    label="Totale restituito dal paziente"
                    value={formatCurrency(primary.standardPatientTotal)}
                    emphasize
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sky-200/80 pt-2">
                    <dt className="text-muted-foreground">
                      Differenza totale per il paziente
                    </dt>
                    <dd className="flex flex-wrap items-center justify-end gap-2">
                      <span className="font-semibold tabular-nums">
                        {patientDiff?.text}
                      </span>
                      {patientDiff?.practicallyEquivalent ? (
                        <Badge variant="secondary">Praticamente equivalente</Badge>
                      ) : null}
                    </dd>
                  </div>
                  <Row
                    label="Commissione finanziata"
                    value={formatCurrency(primary.standardOpeningFeeAmount)}
                  />
                  <Row
                    label="Importo finanziato"
                    value={formatCurrency(primary.standardFinancedAmount)}
                  />
                  <Row
                    label="Costo azienda"
                    value={formatCurrency(primary.standardCompanyCostEuro)}
                  />
                  <Row
                    label="Netto alla società"
                    value={formatCurrency(primary.standardNetToCompanyEuro)}
                  />
                </dl>
              </SideBlock>
            </div>

            <SideBlock title="Impatto PCG">
              <dl className="space-y-1.5 text-sm">
                <Row
                  label={getNetToCompanyReferenceLabel(primary.referenceType)}
                  value={formatCurrency(primary.zeroRateNetToCompanyEuro)}
                />
                <Row
                  label="Netto società - standard+sconto"
                  value={formatCurrency(primary.standardNetToCompanyEuro)}
                />
                <Row
                  label="Differenza prima del compenso medico"
                  value={formatCurrency(
                    primary.netCompanyDifferenceBeforeDoctorCompensationEuro,
                  )}
                />
                <Row
                  label="Riduzione base compenso medico"
                  value={formatCurrency(
                    primary.doctorCompensationBaseReductionEuro,
                  )}
                />
                {primary.doctorCompensationBreakEvenPercent !== undefined ? (
                  <Row
                    label="Soglia teorica di pareggio compenso medico"
                    value={formatDiscountPercent(
                      primary.doctorCompensationBreakEvenPercent,
                    )}
                    title={BREAK_EVEN_EXPLANATION}
                  />
                ) : null}
              </dl>
            </SideBlock>
            {primary.doctorCompensationBreakEvenPercent !== undefined ? (
              <p className="text-xs text-muted-foreground">
                {BREAK_EVEN_EXPLANATION}
              </p>
            ) : null}

            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {primary.warning}
            </div>
            <p className="text-xs text-muted-foreground">
              {primary.doctorCompensationNote}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
