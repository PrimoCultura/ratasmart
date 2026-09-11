import type { ReactNode } from "react";
import type { ZeroInterestAlternativeAnalysis } from "../../../../shared/zero-interest-alternative";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatting/currency";

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
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-background px-3 py-3">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </div>
  );
}

function Row({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground" title={title}>
        {label}
      </dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function ZeroInterestAlternativeCard({
  analysis,
}: ZeroInterestAlternativeCardProps) {
  if (!analysis.enabled) return null;

  const primary = analysis.primary;

  return (
    <Card data-testid="zero-interest-alternative-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Alternativa al tasso zero</CardTitle>
        <p className="text-sm text-muted-foreground">
          RataSmart ha confrontato il tasso zero con una soluzione standard
          applicando uno sconto al piano di cura.
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
            <p className="text-xs text-muted-foreground">
              Riferimento tasso zero: {primary.zeroCompanyShortName} ·{" "}
              {primary.zeroTableCode} · {primary.durationMonths} mesi
            </p>
            <p className="text-xs text-muted-foreground">
              Alternativa standard: {primary.standardCompanyShortName} ·{" "}
              {primary.standardTableCode} · {primary.durationMonths} mesi
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <SideBlock title="Tasso zero">
                <Row
                  label="Piano di cura"
                  value={formatCurrency(primary.zeroRateRequestedAmount)}
                />
                <Row
                  label="Commissione finanziata"
                  value={formatCurrency(primary.zeroRateOpeningFeeAmount)}
                />
                <Row
                  label="Importo finanziato"
                  value={formatCurrency(primary.zeroRateFinancedAmount)}
                />
                <Row label="Durata" value={`${primary.durationMonths} mesi`} />
                <Row
                  label="Rata"
                  value={formatCurrency(primary.zeroRateInstallment)}
                />
                <Row
                  label="Totale restituito dal paziente"
                  value={formatCurrency(primary.zeroRatePatientTotal)}
                />
                <Row
                  label="Costo azienda"
                  value={formatCurrency(primary.zeroRateCompanyCostEuro)}
                />
                <Row
                  label="Netto alla società"
                  value={formatCurrency(primary.zeroRateNetToCompanyEuro)}
                />
              </SideBlock>

              <SideBlock title="Standard + sconto">
                <Row
                  label="Sconto equivalente"
                  value={formatDiscountPercent(primary.discountPercent)}
                />
                <Row
                  label="Nuovo piano"
                  value={formatCurrency(primary.discountedAmount)}
                />
                <Row
                  label="Commissione finanziata"
                  value={formatCurrency(primary.standardOpeningFeeAmount)}
                />
                <Row
                  label="Importo finanziato"
                  value={formatCurrency(primary.standardFinancedAmount)}
                />
                <Row label="Durata" value={`${primary.durationMonths} mesi`} />
                <Row
                  label="Rata"
                  value={formatCurrency(primary.standardInstallment)}
                />
                <Row
                  label="Totale restituito dal paziente"
                  value={formatCurrency(primary.standardPatientTotal)}
                />
                <Row
                  label="Differenza per il paziente"
                  value={formatCurrency(primary.patientTotalDifferenceEuro)}
                />
                <Row
                  label="Costo azienda"
                  value={formatCurrency(primary.standardCompanyCostEuro)}
                />
                <Row
                  label="Netto alla società"
                  value={formatCurrency(primary.standardNetToCompanyEuro)}
                />
              </SideBlock>
            </div>

            <SideBlock title="Impatto PCG">
              <Row
                label="Netto società - tasso zero"
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
