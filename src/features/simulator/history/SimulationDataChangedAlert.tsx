import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type SimulationDataChangedAlertProps = {
  onRecalculate: () => void;
  disabled?: boolean;
};

export function SimulationDataChangedAlert({
  onRecalculate,
  disabled,
}: SimulationDataChangedAlertProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          I dati della simulazione sono cambiati dopo l’ultimo confronto. Le
          soluzioni visualizzate appartengono al confronto precedente.
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={onRecalculate}
      >
        Ricalcola le soluzioni
      </Button>
    </div>
  );
}
