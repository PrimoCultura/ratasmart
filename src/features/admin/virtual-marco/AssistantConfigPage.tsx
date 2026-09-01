import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ActiveBadge } from "@/components/common/ActiveBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { formatDateTime } from "@/lib/formatting/currency";

export function AssistantConfigPage() {
  const { userId } = useCurrentUser();
  const configs = useQuery(api.assistantConfigs.listAssistantConfigs);
  const createVersion = useMutation(
    api.assistantConfigs.createAssistantConfigVersion,
  );
  const updateMetadata = useMutation(
    api.assistantConfigs.updateAssistantConfigMetadata,
  );
  const activate = useMutation(api.assistantConfigs.activateAssistantConfig);
  const seed = useMutation(api.seed.seedVirtualMarcoDemo);
  const testConnection = useAction(api.assistantChat.testVirtualMarcoConnection);

  const [selectedId, setSelectedId] = useState<Id<"assistantConfigs"> | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [form, setForm] = useState({
    name: "Virtual Marco",
    behaviorPrompt: "",
    modelProvider: "openai",
    modelName: "gpt-5.6-luna",
    temperature: "0.2",
    maxOutputTokens: "1200",
    adminNotes: "",
  });

  const selected = useMemo(
    () => configs?.find((item) => item._id === selectedId) ?? configs?.[0],
    [configs, selectedId],
  );

  const previous = useMemo(() => {
    if (!configs || !selected?.supersedesConfigId) return null;
    return configs.find((item) => item._id === selected.supersedesConfigId) ?? null;
  }, [configs, selected]);

  if (configs === undefined) {
    return <LoadingState />;
  }

  const loadIntoForm = (configId: Id<"assistantConfigs">) => {
    const config = configs.find((item) => item._id === configId);
    if (!config) return;
    setSelectedId(configId);
    setForm({
      name: config.name,
      behaviorPrompt: config.behaviorPrompt,
      modelProvider: config.modelProvider,
      modelName: config.modelName,
      temperature: String(config.temperature),
      maxOutputTokens: String(config.maxOutputTokens),
      adminNotes: config.adminNotes ?? "",
    });
  };

  const handleSeed = async () => {
    if (!userId) return;
    try {
      const result = await seed({ actorUserId: userId });
      toast.success(
        result.configCreated
          ? "Configurazione demo creata"
          : result.configUpgraded
            ? "Configurazione aggiornata a gpt-5.6-luna (nuova versione)"
            : "Configurazione demo già presente",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Seed non riuscito.");
    }
  };

  const handleTestConnection = async () => {
    if (!userId) return;
    setIsTesting(true);
    try {
      const result = await testConnection({ actorUserId: userId });
      if (result.ok) {
        toast.success(
          `Connessione OK · ${result.model} · ${result.latencyMs}ms · token ${result.totalTokens ?? "n/d"}`,
        );
      } else {
        toast.error(
          `Test fallito (${result.errorCode}): ${result.errorMessage}`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test non riuscito.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      const id = await createVersion({
        actorUserId: userId,
        name: form.name,
        behaviorPrompt: form.behaviorPrompt,
        modelProvider: form.modelProvider,
        modelName: form.modelName,
        temperature: Number(form.temperature),
        maxOutputTokens: Number(form.maxOutputTokens),
        adminNotes: form.adminNotes || undefined,
        activate: true,
        supersedesConfigId: selected?._id,
      });
      toast.success("Nuova versione creata e attivata");
      setSelectedId(id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Salvataggio non riuscito.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!userId || !selected) return;
    try {
      await updateMetadata({
        actorUserId: userId,
        configId: selected._id,
        adminNotes: form.adminNotes,
        name: form.name,
      });
      toast.success("Metadati aggiornati");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Aggiornamento non riuscito.",
      );
    }
  };

  const handleActivate = async (configId: Id<"assistantConfigs">) => {
    if (!userId) return;
    try {
      await activate({ actorUserId: userId, configId });
      toast.success("Configurazione attivata");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Attivazione non riuscita.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurazione Virtual Marco"
        description="Prompt di comportamento e parametri modello (senza chiavi API)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void handleSeed()}>
              Esegui seed demo
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isTesting}
              onClick={() => void handleTestConnection()}
            >
              {isTesting ? "Test in corso…" : "Testa connessione"}
            </Button>
          </div>
        }
      />

      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        Il prompt di comportamento deve definire ruolo e limiti dell’assistente.
        Tabelle, condizioni economiche e procedure operative devono essere gestite
        nelle sezioni dedicate e non copiate nel prompt.
      </div>
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Testa connessione usa la configurazione attiva e può consumare token API.
        Nessuna chiave API è mostrata o salvata nel database. Modello demo seed:{" "}
        <code>gpt-5.6-luna</code> (modificabile dall’admin).
      </div>

      {configs.length === 0 ? (
        <EmptyState
          title="Nessuna configurazione"
          description="Esegui il seed demo oppure crea la prima versione."
        />
      ) : (
        <div className="space-y-2">
          {configs.map((config) => (
            <div
              key={config._id}
              className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">
                  {config.name} · v{config.version}
                </p>
                <p className="text-xs text-muted-foreground">
                  {config.modelProvider}/{config.modelName} · aggiornata{" "}
                  {formatDateTime(config.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ActiveBadge active={config.isActive} />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => loadIntoForm(config._id)}
                >
                  Visualizza
                </Button>
                {!config.isActive ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleActivate(config._id)}
                  >
                    Attiva
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {selected
              ? `Modifica / nuova versione (base v${selected.version})`
              : "Nuova configurazione"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Note admin</Label>
              <Input
                value={form.adminNotes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    adminNotes: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Input
                value={form.modelProvider}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    modelProvider: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Modello</Label>
              <Input
                value={form.modelName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    modelName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Temperatura</Label>
              <Input
                value={form.temperature}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    temperature: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max output tokens</Label>
              <Input
                value={form.maxOutputTokens}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxOutputTokens: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Prompt di comportamento</Label>
            <Textarea
              className="min-h-64 font-mono text-xs"
              value={form.behaviorPrompt}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  behaviorPrompt: event.target.value,
                }))
              }
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => void handleCreateVersion()}
            >
              {isSaving ? "Salvataggio…" : "Crea nuova versione"}
            </Button>
            {selected ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSaveNotes()}
              >
                Salva solo metadati
              </Button>
            ) : null}
          </div>
          {previous ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
              <p className="font-medium">Confronto con versione precedente (v{previous.version})</p>
              <p className="mt-1 text-muted-foreground">
                Prompt precedente: {previous.behaviorPrompt.length} caratteri ·{" "}
                {previous.modelName} · temp {previous.temperature}
              </p>
              <p className="mt-1 text-muted-foreground">
                Prompt corrente in form: {form.behaviorPrompt.length} caratteri
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
