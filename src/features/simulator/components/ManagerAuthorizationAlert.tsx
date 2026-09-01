import { ShieldAlert } from "lucide-react";

type ManagerAuthorizationAlertProps = {
  className?: string;
};

export function ManagerAuthorizationAlert({
  className,
}: ManagerAuthorizationAlertProps = {}) {
  return (
    <div
      className={
        className ??
        "flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
      }
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Questa soluzione comporta un costo per l’azienda. Prima di procedere con
        il caricamento della pratica è necessario richiedere l’autorizzazione al
        proprio responsabile.
      </p>
    </div>
  );
}
