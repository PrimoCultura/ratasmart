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

type SelectProposedSolutionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
  hasExistingProposal: boolean;
};

export function SelectProposedSolutionDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  hasExistingProposal,
}: SelectProposedSolutionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Segnare come soluzione proposta?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasExistingProposal
              ? "Questa operazione sostituirà la soluzione attualmente indicata come proposta al paziente."
              : "Questa soluzione verrà indicata come proposta al paziente."}
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
            {isLoading ? "Salvataggio…" : "Conferma proposta"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
