import { formatCurrency } from "@/lib/formatting/currency";

type ComparisonHeaderProps = {
  requestedAmount: number;
  durationMonths: number;
  targetInstallment?: number;
};

export function ComparisonHeader({
  requestedAmount,
  durationMonths,
  targetInstallment,
}: ComparisonHeaderProps) {
  const parts = [
    `Importo ${formatCurrency(requestedAmount)}`,
    `Durata ${durationMonths} mesi`,
  ];
  if (targetInstallment !== undefined) {
    parts.push(`Rata obiettivo ${formatCurrency(targetInstallment)}`);
  }

  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold tracking-tight">
        Confronto soluzioni
      </h2>
      <p className="text-sm text-muted-foreground">{parts.join(" · ")}</p>
    </div>
  );
}
