import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { formatDateTime } from "@/lib/formatting/currency";

export function AdminUsersPage() {
  const { userId } = useCurrentUser();
  const [role, setRole] = useState<"ALL" | "cm" | "admin">("ALL");
  const [status, setStatus] = useState<"ALL" | "active" | "inactive">("ALL");
  const [clinicName, setClinicName] = useState("ALL");
  const [search, setSearch] = useState("");
  const [confirmDisable, setConfirmDisable] = useState<Id<"appUsers"> | null>(
    null,
  );
  const [confirmAnonymize, setConfirmAnonymize] = useState<Id<"appUsers"> | null>(
    null,
  );

  const users = useQuery(
    api.adminGovernance.listAdminUsers,
    userId
      ? {
          actorUserId: userId,
          role: role === "ALL" ? undefined : role,
          status: status === "ALL" ? undefined : status,
          clinicName: clinicName === "ALL" ? undefined : clinicName,
          search: search.trim() || undefined,
        }
      : "skip",
  );
  const filterOptions = useQuery(
    api.adminAnalytics.listFilterOptions,
    userId ? { actorUserId: userId } : "skip",
  );
  const auditLogs = useQuery(
    api.adminGovernance.listAdminAuditLogs,
    userId ? { actorUserId: userId, limit: 20 } : "skip",
  );

  const setUserActive = useMutation(api.adminGovernance.setUserActive);
  const anonymizeUser = useMutation(api.adminGovernance.anonymizeUser);

  const clinics = useMemo(
    () => filterOptions?.clinics ?? [],
    [filterOptions],
  );

  if (users === undefined || filterOptions === undefined) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utenti"
        description="Governance profili applicativi (auth demo pre-Auth0). Nessun account IdP esterno da eliminare."
      />

      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="Cerca nome, clinica…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          value={role}
          onValueChange={(value) => setRole(value as typeof role)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Ruolo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutti i ruoli</SelectItem>
            <SelectItem value="cm">CM</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as typeof status)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutti gli stati</SelectItem>
            <SelectItem value="active">Attivi</SelectItem>
            <SelectItem value="inactive">Disattivi</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clinicName} onValueChange={setClinicName}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Clinica" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutte le cliniche</SelectItem>
            {clinics.map((clinic) => (
              <SelectItem key={clinic} value={clinic}>
                {clinic}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Filtro network utente non disponibile: il network è sulle simulazioni, non
        sul profilo.
      </p>

      {users.length === 0 ? (
        <EmptyState
          title="Nessun utente"
          description="Nessun profilo corrisponde ai filtri."
        />
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user._id}
              className="flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <Badge variant="outline">{user.role}</Badge>
                  <Badge variant={user.isActive ? "secondary" : "warning"}>
                    {user.isActive ? "Attivo" : "Disattivo"}
                  </Badge>
                  {user.anonymizedAt ? (
                    <Badge variant="outline">Anonymizzato</Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {user.clinicName ?? "Clinica n/d"} · login:{" "}
                  {user.externalAuthId ?? "demo (no email)"} · creato{" "}
                  {formatDateTime(user.createdAt)} · ultimo accesso n/d ·{" "}
                  {user.simulationsCount} simulazioni
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {user.isActive ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(user.anonymizedAt) || user._id === userId}
                    onClick={() => setConfirmDisable(user._id)}
                  >
                    Disattiva
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(user.anonymizedAt)}
                    onClick={async () => {
                      if (!userId) return;
                      try {
                        await setUserActive({
                          actorUserId: userId,
                          userId: user._id,
                          isActive: true,
                        });
                        toast.success("Utente riattivato");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Operazione non riuscita",
                        );
                      }
                    }}
                  >
                    Riattiva
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={Boolean(user.anonymizedAt) || user._id === userId}
                  onClick={() => setConfirmAnonymize(user._id)}
                >
                  Elimina profilo
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Audit recente</h2>
        {auditLogs === undefined ? (
          <LoadingState />
        ) : auditLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nessuna azione registrata.</p>
        ) : (
          <div className="space-y-1">
            {auditLogs.map((log) => (
              <p key={log._id} className="text-xs text-muted-foreground">
                {formatDateTime(log.timestamp)} · {log.action} · {log.entityType}{" "}
                {log.entityId.slice(0, 8)}…
              </p>
            ))}
          </div>
        )}
      </section>

      <AlertDialog
        open={confirmDisable !== null}
        onOpenChange={(open) => !open && setConfirmDisable(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disattivare utente?</AlertDialogTitle>
            <AlertDialogDescription>
              L’utente non potrà più usare l’app. I dati storici restano disponibili.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!userId || !confirmDisable) return;
                try {
                  await setUserActive({
                    actorUserId: userId,
                    userId: confirmDisable,
                    isActive: false,
                  });
                  toast.success("Utente disattivato");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Operazione non riuscita",
                  );
                } finally {
                  setConfirmDisable(null);
                }
              }}
            >
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmAnonymize !== null}
        onOpenChange={(open) => !open && setConfirmAnonymize(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare (anonymizzare) profilo?</AlertDialogTitle>
            <AlertDialogDescription>
              Anonymizza il profilo applicativo e lo disattiva. Le simulazioni
              storiche restano per analytics. Non esiste un account Auth0 da
              cancellare in questa fase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!userId || !confirmAnonymize) return;
                try {
                  await anonymizeUser({
                    actorUserId: userId,
                    userId: confirmAnonymize,
                  });
                  toast.success("Profilo anonymizzato");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Operazione non riuscita",
                  );
                } finally {
                  setConfirmAnonymize(null);
                }
              }}
            >
              Conferma eliminazione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
