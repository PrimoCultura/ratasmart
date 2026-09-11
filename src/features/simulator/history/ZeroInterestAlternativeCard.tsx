import { useState, type ReactNode } from "react";
import type { ZeroInterestAlternativeAnalysis } from "../../../../shared/zero-interest-alternative";
import {
  formatPatientTotalDifferenceCopy,
  getNetToCompanyReferenceLabel,
  getPrimaryProductHeadline,
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

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          emphasize
            ? "text-right font-semibold tabular-nums"
            : "text-right font-medium tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function CollapsibleBlock({
  title,
  testId,
  defaultOpen = false,
  children,
}: {
  title: string;
  testId: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div data-testid={testId} className="rounded-md border border-border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <span className="text-xs text-muted-foreground">
          {open ? "Nascondi" : "Mostra"}
        </span>
      </button>
      {open ? <div className="space-y-2 border-t px-3 py-2">{children}</div> : null}
    </div>
  );
}

export function ZeroInterestAlternativeCard({
  analysis,
}: ZeroInterestAlternativeCardProps) {
  if (!analysis.enabled) return null;

  const primary = analysis.primary;
  const patientDiff = primary
    ? formatPatientTotalDifferenceCopy(primary.patientTotalDifferenceEuro)
    : null;

  return (
    <Card
      id={ZERO_INTEREST_ALTERNATIVE_ANCHOR_ID}
      data-testid="zero-interest-alternative-card"
      className="scroll-mt-4"
    >
      <CardHeader className="space-y-1 py-3">
        <CardTitle className="text-base">Alternativa al tasso zero</CardTitle>
        <p className="text-sm text-muted-foreground">
          Confronto tra tasso zero e soluzione standard con sconto equivalente
          sul piano di cura.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
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
              <div className="space-y-2 rounded-md border border-border px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tasso zero di riferimento
                </p>
                <p className="text-base font-semibold">
                  {primary.zeroCompanyShortName} {primary.zeroTableCode} ·{" "}
                  {primary.durationMonths} mesi
                </p>
                <dl className="space-y-1">
                  <Row
                    label="Piano"
                    value={formatCurrency(primary.zeroRateRequestedAmount)}
                  />
                  <Row
                    label="Rata"
                    value={formatCurrency(primary.zeroRateInstallment)}
                  />
                  <Row
                    label="Totale paziente"
                    value={formatCurrency(primary.zeroRatePatientTotal)}
                    emphasize
                  />
                  <Row
                    label="Costo azienda"
                    value={formatCurrency(primary.zeroRateCompanyCostEuro)}
                  />
                </dl>
              </div>

              <div
                className="space-y-2 rounded-md border-2 border-sky-300 bg-sky-50/50 px-3 py-2.5"
                data-testid="standard-proposal-headline"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/70">
                  Standard + sconto
                </p>
                <p className="text-base font-semibold">
                  {getPrimaryProductHeadline(primary)} · {primary.durationMonths}{" "}
                  mesi
                </p>
                <dl className="space-y-1">
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
                  />
                  <Row
                    label="Totale paziente"
                    value={formatCurrency(primary.standardPatientTotal)}
                    emphasize
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <dt className="text-sm text-muted-foreground">Differenza</dt>
                    <dd className="flex flex-wrap items-center justify-end gap-2 text-sm">
                      <span className="font-semibold tabular-nums">
                        {patientDiff?.text}
                      </span>
                      {patientDiff?.practicallyEquivalent ? (
                        <Badge variant="secondary">Praticamente equivalente</Badge>
                      ) : null}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <CollapsibleBlock
              title="Dettagli economici"
              testId="zero-alt-economic-details"
              defaultOpen={false}
            >
              <dl className="space-y-1 text-sm">
                <Row
                  label="Commissione zero"
                  value={formatCurrency(primary.zeroRateOpeningFeeAmount)}
                />
                <Row
                  label="Finanziato zero"
                  value={formatCurrency(primary.zeroRateFinancedAmount)}
                />
                <Row
                  label="Commissione standard"
                  value={formatCurrency(primary.standardOpeningFeeAmount)}
                />
                <Row
                  label="Finanziato standard"
                  value={formatCurrency(primary.standardFinancedAmount)}
                />
                <Row
                  label="Netto società zero"
                  value={formatCurrency(primary.zeroRateNetToCompanyEuro)}
                />
                <Row
                  label="Netto società standard"
                  value={formatCurrency(primary.standardNetToCompanyEuro)}
                />
              </dl>
            </CollapsibleBlock>

            <CollapsibleBlock
              title="Impatto PCG"
              testId="zero-alt-pcg-impact"
              defaultOpen={false}
            >
              <dl className="space-y-1 text-sm">
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
                  <>
                    <Row
                      label="Soglia teorica di pareggio"
                      value={formatDiscountPercent(
                        primary.doctorCompensationBreakEvenPercent,
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      {BREAK_EVEN_EXPLANATION}
                    </p>
                  </>
                ) : null}
              </dl>
              <p className="text-xs text-muted-foreground">
                {primary.doctorCompensationNote}
              </p>
            </CollapsibleBlock>

            <p
              data-testid="zero-alt-autonomy-warning"
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-950"
            >
              {primary.warning}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
