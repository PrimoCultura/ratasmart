import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatting/currency";

type CompanyCostAlertProps = {
  internalCostAmount: number;
  className?: string;
  compact?: boolean;
};

/**
 * Indicazione sintetica di costo/autorizzazione per la card compatta.
 * Non sostituisce l'alert manager nel dettaglio espanso.
 */
export function CompanyCostAlert({
  internalCostAmount,
  className,
  compact = true,
}: CompanyCostAlertProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border border-red-200/80 bg-red-50/80 px-2.5 py-2 text-xs text-red-900",
        className,
      )}
    >
      <ShieldAlert
        className="mt-0.5 h-3.5 w-3.5 shrink-0"
        aria-label="Autorizzazione responsabile richiesta"
      />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">
          Costo aziendale: {formatCurrency(internalCostAmount)}
        </p>
        <p className={compact ? "text-[11px] leading-snug text-red-800/90" : undefined}>
          Autorizzazione del responsabile necessaria
        </p>
      </div>
    </div>
  );
}
