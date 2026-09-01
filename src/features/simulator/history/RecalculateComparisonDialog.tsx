import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type RecalculateComparisonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
};

export function RecalculateComparisonDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: RecalculateComparisonDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ricalcola con le condizioni attuali</AlertDialogTitle>
          <AlertDialogDescription>
            Verrà creato un nuovo confronto utilizzando i dati della simulazione
            e le condizioni finanziarie attualmente attive. I confronti precedenti
            e l’eventuale soluzione già proposta resteranno invariati.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Annulla</AlertDialogCancel>
          <AlertDialogAction
            disabled={isLoading}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isLoading ? "Creazione in corso…" : "Crea nuovo confronto"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
