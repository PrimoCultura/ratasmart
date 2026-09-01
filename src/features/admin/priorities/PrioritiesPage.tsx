import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { formatDate } from "@/lib/formatting/currency";

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

export function PrioritiesPage() {
  const { userId } = useCurrentUser();
  const priorities = useQuery(api.commercialPriorities.listCommercialPriorities);
  const companies = useQuery(api.financialCompanies.listFinancialCompanies);
  const products = useQuery(api.financialProducts.listFinancialProducts);
  const tables = useQuery(api.financialTables.listFinancialTablesAdmin);
  const createPriority = useMutation(api.commercialPriorities.createCommercialPriority);
  const updatePriority = useMutation(api.commercialPriorities.updateCommercialPriority);
  const setActive = useMutation(api.commercialPriorities.setCommercialPriorityActive);
  const removePriority = useMutation(api.commercialPriorities.deleteCommercialPriority);

  const [editingId, setEditingId] = useState<Id<"commercialPriorities"> | null>(null);
  const [form, setForm] = useState({
    network: "PCG" as Network,
    companyId: "",
    productId: "",
    financialTableId: "",
    label: "",
    internalReason: "",
    visibleReason: "",
    priorityScore: "100",
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
    priorities === undefined ||
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
      label: "",
      internalReason: "",
      visibleReason: "",
      priorityScore: "100",
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
      label: form.label,
      internalReason: form.internalReason || undefined,
      visibleReason: form.visibleReason || undefined,
      priorityScore: Number(form.priorityScore),
      validFrom: parseOptionalDate(form.validFrom),
      validTo: parseOptionalDate(form.validTo),
    };

    try {
      if (editingId) {
        await updatePriority({
          actorUserId: userId,
          priorityId: editingId,
          ...payload,
        });
        toast.success("Priorità aggiornata");
      } else {
        await createPriority({
          actorUserId: userId,
          ...payload,
          isActive: form.isActive,
        });
        toast.success("Priorità creata");
      }
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salvataggio non riuscito");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Priorità commerciali"
        description="Modificano solo l'ordine futuro delle soluzioni compatibili, non la compatibilità."
      />

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Modifica priorità" : "Nuova priorità"}</CardTitle>
          <CardDescription>
            Una tabella non compatibile non potrà essere proposta solo perché prioritaria.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Etichetta</Label>
            <Input
              value={form.label}
              onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Punteggio</Label>
            <Input
              value={form.priorityScore}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, priorityScore: e.target.value }))
              }
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
            <Label>Motivo interno</Label>
            <Textarea
              value={form.internalReason}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, internalReason: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Motivo visibile al CM</Label>
            <Textarea
              value={form.visibleReason}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, visibleReason: e.target.value }))
              }
            />
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
          {!editingId ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, isActive: checked }))
                }
              />
              Attiva
            </label>
          ) : null}
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

      {priorities.length === 0 ? (
        <EmptyState title="Nessuna priorità" description="Crea la prima priorità commerciale." />
      ) : (
        <div className="space-y-2">
          {priorities.map((item) => (
            <div
              key={item._id}
              className="flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.label}</p>
                  <ActiveBadge active={item.isActive} />
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    score {item.priorityScore}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.network}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.company?.name ?? "tutte le società"} ·{" "}
                  {item.product?.name ?? "tutti i prodotti"} ·{" "}
                  {item.financialTable?.tableCode ?? "tutte le tabelle"}
                  {item.validFrom || item.validTo
                    ? ` · validità ${item.validFrom ? formatDate(item.validFrom) : "…"} → ${item.validTo ? formatDate(item.validTo) : "…"}`
                    : ""}
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
                      label: item.label,
                      internalReason: item.internalReason ?? "",
                      visibleReason: item.visibleReason ?? "",
                      priorityScore: String(item.priorityScore),
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
                      priorityId: item._id,
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
                    void removePriority({
                      actorUserId: userId,
                      priorityId: item._id,
                    })
                      .then(() => toast.success("Priorità eliminata"))
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
