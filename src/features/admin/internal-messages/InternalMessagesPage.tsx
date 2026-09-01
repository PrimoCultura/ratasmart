import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Info, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ActiveBadge } from "@/components/common/ActiveBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { NETWORKS, type Network } from "@/lib/constants/app";
import {
  ICON_TYPES,
  ICON_TYPE_LABELS,
  MESSAGE_TYPES,
  MESSAGE_TYPE_LABELS,
  type IconType,
  type MessageType,
} from "@/lib/constants/financial";

function parseOptionalDate(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.getTime();
}

function toDateInput(value?: number): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function InternalMessagesPage() {
  const { userId } = useCurrentUser();
  const messages = useQuery(api.internalMessages.listInternalMessages);
  const companies = useQuery(api.financialCompanies.listFinancialCompanies);
  const products = useQuery(api.financialProducts.listFinancialProducts);
  const tables = useQuery(api.financialTables.listFinancialTablesAdmin);
  const createMessage = useMutation(api.internalMessages.createInternalMessage);
  const updateMessage = useMutation(api.internalMessages.updateInternalMessage);
  const setActive = useMutation(api.internalMessages.setInternalMessageActive);
  const removeMessage = useMutation(api.internalMessages.deleteInternalMessage);

  const [editingId, setEditingId] = useState<Id<"internalMessages"> | null>(null);
  const [form, setForm] = useState({
    network: "PCG" as Network,
    companyId: "",
    productId: "",
    financialTableId: "",
    title: "",
    message: "",
    messageType: "positive" as MessageType,
    iconType: "plus" as IconType,
    requiresPrivacyConfirmation: true,
    isActive: true,
    validFrom: "",
    validTo: "",
  });

  const filteredProducts = useMemo(
    () =>
      (products ?? []).filter((product) =>
        form.companyId ? product.companyId === form.companyId : true,
      ),
    [products, form.companyId],
  );
  const filteredTables = useMemo(
    () =>
      (tables ?? []).filter((table) =>
        form.companyId ? table.companyId === form.companyId : true,
      ),
    [tables, form.companyId],
  );

  if (
    messages === undefined ||
    companies === undefined ||
    products === undefined ||
    tables === undefined
  ) {
    return <LoadingState />;
  }

  const reset = () => {
    setEditingId(null);
    setForm({
      network: "PCG",
      companyId: "",
      productId: "",
      financialTableId: "",
      title: "",
      message: "",
      messageType: "positive",
      iconType: "plus",
      requiresPrivacyConfirmation: true,
      isActive: true,
      validFrom: "",
      validTo: "",
    });
  };

  const save = async () => {
    if (!userId) return;
    const payload = {
      network: form.network,
      companyId: form.companyId
        ? (form.companyId as Id<"financialCompanies">)
        : undefined,
      productId: form.productId
        ? (form.productId as Id<"financialProducts">)
        : undefined,
      financialTableId: form.financialTableId
        ? (form.financialTableId as Id<"financialTables">)
        : undefined,
      title: form.title,
      message: form.message,
      messageType: form.messageType,
      iconType: form.iconType,
      requiresPrivacyConfirmation: form.requiresPrivacyConfirmation,
      validFrom: parseOptionalDate(form.validFrom),
      validTo: parseOptionalDate(form.validTo),
    };

    try {
      if (editingId) {
        await updateMessage({
          actorUserId: userId,
          messageId: editingId,
          ...payload,
        });
        toast.success("Messaggio aggiornato");
      } else {
        await createMessage({
          actorUserId: userId,
          ...payload,
          isActive: form.isActive,
        });
        toast.success("Messaggio creato");
      }
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salvataggio non riuscito");
    }
  };

  const PreviewIcon =
    form.iconType === "plus"
      ? Plus
      : form.iconType === "exclamation"
        ? AlertTriangle
        : Info;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messaggi interni"
        description="Contenuti riservati al personale, protetti da conferma privacy lato CM."
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Modifica messaggio" : "Nuovo messaggio"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Titolo</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Rete</Label>
              <Select
                value={form.network}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, network: value as Network }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NETWORKS.map((network) => (
                    <SelectItem key={network} value={network}>
                      {network}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Messaggio</Label>
              <Textarea
                value={form.message}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, message: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tipologia</Label>
              <Select
                value={form.messageType}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    messageType: value as MessageType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESSAGE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {MESSAGE_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Icona</Label>
              <Select
                value={form.iconType}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, iconType: value as IconType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ICON_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Società (opzionale)</Label>
              <Select
                value={form.companyId || "__none"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    companyId: value === "__none" ? "" : value,
                    productId: "",
                    financialTableId: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nessuna</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company._id} value={company._id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prodotto (opzionale)</Label>
              <Select
                value={form.productId || "__none"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    productId: value === "__none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nessuno</SelectItem>
                  {filteredProducts.map((product) => (
                    <SelectItem key={product._id} value={product._id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tabella (opzionale)</Label>
              <Select
                value={form.financialTableId || "__none"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    financialTableId: value === "__none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nessuna</SelectItem>
                  {filteredTables.map((table) => (
                    <SelectItem key={table._id} value={table._id}>
                      {table.tableCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valida da</Label>
              <Input
                type="date"
                value={form.validFrom}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, validFrom: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Valida a</Label>
              <Input
                type="date"
                value={form.validTo}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, validTo: e.target.value }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox
                checked={form.requiresPrivacyConfirmation}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    requiresPrivacyConfirmation: checked,
                  }))
                }
              />
              Richiede conferma privacy
            </label>
            <div className="sm:col-span-2 flex gap-2">
              <Button onClick={() => void save()}>Salva</Button>
              {editingId ? (
                <Button variant="outline" onClick={reset}>
                  Annulla
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview CM</CardTitle>
            <CardDescription>
              Il testo non compare in chiaro: solo icona, poi conferma privacy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-success"
              aria-label="Anteprima icona messaggio interno"
            >
              <PreviewIcon className="h-4 w-4" />
            </button>
            <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
              Contenuto riservato al personale.
              <br />
              Verifica che il paziente non possa visualizzare lo schermo.
              <div className="mt-3">
                <Button size="sm" variant="secondary" disabled>
                  Mostra informazione interna
                </Button>
              </div>
            </div>
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <p className="font-medium">{form.title || "Titolo messaggio"}</p>
              <p className="text-muted-foreground">
                {form.message || "Testo del messaggio interno…"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {messages.length === 0 ? (
        <EmptyState
          title="Nessun messaggio interno"
          description="Crea un messaggio riservato collegato a rete o tabella."
        />
      ) : (
        <div className="space-y-2">
          {messages.map((item) => (
            <div
              key={item._id}
              className="flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.title}</p>
                  <ActiveBadge active={item.isActive} />
                  <span className="text-xs text-muted-foreground">
                    {MESSAGE_TYPE_LABELS[item.messageType]} · {item.network}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.company?.name ?? "tutte le società"} ·{" "}
                  {item.financialTable?.tableCode ?? "tutte le tabelle"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(item._id);
                    setForm({
                      network: item.network,
                      companyId: item.companyId ?? "",
                      productId: item.productId ?? "",
                      financialTableId: item.financialTableId ?? "",
                      title: item.title,
                      message: item.message,
                      messageType: item.messageType,
                      iconType: item.iconType,
                      requiresPrivacyConfirmation: item.requiresPrivacyConfirmation,
                      isActive: item.isActive,
                      validFrom: toDateInput(item.validFrom),
                      validTo: toDateInput(item.validTo),
                    });
                  }}
                >
                  Modifica
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!userId) return;
                    void setActive({
                      actorUserId: userId,
                      messageId: item._id,
                      isActive: !item.isActive,
                    })
                      .then(() => toast.success("Stato aggiornato"))
                      .catch((error: unknown) =>
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Operazione non riuscita",
                        ),
                      );
                  }}
                >
                  {item.isActive ? "Disattiva" : "Attiva"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!userId) return;
                    void removeMessage({
                      actorUserId: userId,
                      messageId: item._id,
                    })
                      .then(() => toast.success("Messaggio eliminato"))
                      .catch((error: unknown) =>
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Eliminazione non riuscita",
                        ),
                      );
                  }}
                >
                  Elimina
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
