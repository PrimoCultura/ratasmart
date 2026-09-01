import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/common/LoadingState";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import {
  APP_NAME,
  APP_PAYOFF,
  APP_SUBTITLE,
  MAX_DEMO_CM_USERS,
} from "@/lib/constants/app";
import {
  demoCmProfileSchema,
  type DemoCmProfileInput,
} from "@/lib/validation/schemas";

export function LoginPage() {
  const navigate = useNavigate();
  const { selectUser, ensureDemoAdmin, isLoading: authLoading } = useCurrentUser();
  const demoUsers = useQuery(api.users.listDemoCmUsers);
  const createDemoCmUser = useMutation(api.users.createDemoCmUser);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  const form = useForm<DemoCmProfileInput>({
    resolver: zodResolver(demoCmProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      clinicName: "",
    },
  });

  const canCreateMore =
    demoUsers !== undefined && demoUsers.length < MAX_DEMO_CM_USERS;

  const handleSelectProfile = (userId: Id<"appUsers">) => {
    selectUser(userId);
    toast.success("Profilo selezionato");
    navigate("/app");
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      const userId = await createDemoCmUser(values);
      selectUser(userId);
      toast.success("Profilo CM demo creato");
      navigate("/app");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossibile creare il profilo demo.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleAdminAccess = async () => {
    setIsAdminLoading(true);
    try {
      await ensureDemoAdmin();
      toast.success("Accesso admin demo attivo");
      navigate("/admin");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossibile attivare l'admin demo.";
      toast.error(message);
    } finally {
      setIsAdminLoading(false);
    }
  };

  if (authLoading || demoUsers === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Preparazione accesso demo…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--color-primary-soft),_transparent_55%),linear-gradient(180deg,var(--color-surface)_0%,var(--color-background)_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 px-4 py-10 sm:px-6">
        <header className="space-y-3 text-center sm:text-left">
          <p className="text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
            {APP_NAME}
          </p>
          <p className="text-base text-foreground/80">{APP_PAYOFF}</p>
          <p className="max-w-2xl text-sm text-muted-foreground">{APP_SUBTITLE}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Accesso CM demo</CardTitle>
              <CardDescription>
                Crea fino a {MAX_DEMO_CM_USERS} profili Clinic Manager oppure
                seleziona un profilo esistente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {demoUsers.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Profili disponibili</p>
                  <div className="space-y-2">
                    {demoUsers.map((user) => (
                      <button
                        key={user._id}
                        type="button"
                        onClick={() => handleSelectProfile(user._id)}
                        className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-3 text-left transition hover:border-primary/40 hover:bg-muted/40"
                      >
                        <span>
                          <span className="block text-sm font-medium">
                            {user.displayName}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {user.clinicName}
                          </span>
                        </span>
                        <Badge variant="secondary">Entra</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {canCreateMore ? (
                <form className="space-y-4" onSubmit={onSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nome</Label>
                    <Input id="firstName" {...form.register("firstName")} />
                    {form.formState.errors.firstName ? (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.firstName.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Cognome</Label>
                    <Input id="lastName" {...form.register("lastName")} />
                    {form.formState.errors.lastName ? (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.lastName.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinicName">Nome clinica</Label>
                    <Input id="clinicName" {...form.register("clinicName")} />
                    {form.formState.errors.clinicName ? (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.clinicName.message}
                      </p>
                    ) : null}
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Creazione…" : "Crea profilo CM demo"}
                  </Button>
                </form>
              ) : (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  Limite di {MAX_DEMO_CM_USERS} profili CM raggiunto. Seleziona
                  uno dei profili esistenti.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Accesso admin</CardTitle>
                <Badge variant="warning">Solo sviluppo</Badge>
              </div>
              <CardDescription>
                Entra nel pannello di amministrazione demo senza password.
                Disponibile soltanto in questa fase di sviluppo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                L&apos;admin può consultare tutte le simulazioni e le metriche
                aggregate. Le sezioni finanziarie e policy sono ancora
                segnaposto.
              </p>
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleAdminAccess}
                disabled={isAdminLoading}
              >
                {isAdminLoading ? "Accesso…" : "Entra come admin demo"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
