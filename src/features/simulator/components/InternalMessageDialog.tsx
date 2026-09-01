import { useState } from "react";
import { AlertTriangle, Info, Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type ProtectedInternalMessage = {
  id: string;
  title: string;
  message: string;
  messageType: "positive" | "warning" | "information";
  iconType: "plus" | "exclamation" | "info";
  requiresPrivacyConfirmation?: boolean;
};

type InternalMessageDialogProps = {
  message: ProtectedInternalMessage;
};

export function InternalMessageDialog({ message }: InternalMessageDialogProps) {
  const needsPrivacy = message.requiresPrivacyConfirmation !== false;
  const [revealed, setRevealed] = useState(!needsPrivacy);
  const Icon =
    message.iconType === "plus"
      ? Plus
      : message.iconType === "exclamation"
        ? AlertTriangle
        : Info;

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) {
          setRevealed(!needsPrivacy);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full",
            "bg-success/15 text-success",
          )}
          aria-label="Apri messaggio interno"
          title="Messaggio interno"
        >
          <Icon className="h-4 w-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {revealed ? message.title : "Contenuto riservato"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              {!revealed ? (
                <p>
                  Contenuto riservato al personale. Verifica che il paziente non
                  possa visualizzare lo schermo.
                </p>
              ) : (
                <p className="text-foreground">{message.message}</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Chiudi</AlertDialogCancel>
          {!revealed ? (
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                setRevealed(true);
              }}
            >
              Mostra informazione interna
            </AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
