import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ActiveBadge } from "@/components/common/ActiveBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function PoliciesPage() {
  const { userId } = useCurrentUser();
  const policies = useQuery(api.policies.listPolicySets);
  const companies = useQuery(api.financialCompanies.listFinancialCompanies);
  const products = useQuery(api.financialProducts.listFinancialProducts);
  const tables = useQuery(api.financialTables.listFinancialTablesAdmin);
  const createPolicy = useMutation(api.policies.createPolicySet);
  const setActive = useMutation(api.policies.setPolicySetActive);

  const [form, setForm] = useState({
    companyId: "",
    productId: "",
    financialTableId: "",
    network: "PCG" as Network,
    name: "",
    description: "",
    sourceReference: "",
    isActive: true,
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
    policies === undefined ||
    companies === undefined ||
    products === undefined ||
    tables === undefined
  ) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policy"
        description="Policy formali di compatibilità. Il motore di valutazione arriverà nella fase successiva."
      />

      <Card>
        <CardHeader>
          <CardTitle>Nuova policy</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
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
            <Label>Società</Label>
            <Select
              value={form.companyId || undefined}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  companyId: value,
                  productId: "",
                  financialTableId: "",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona" />
              </SelectTrigger>
              <SelectContent>
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
                <SelectValue placeholder="Nessuno" />
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
                <SelectValue placeholder="Nessuna" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Nessuna</SelectItem>
                {filteredTables.map((table) => (
                  <SelectItem key={table._id} value={table._id}>
                    {table.tableCode} · {table.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Riferimento sorgente</Label>
            <Input
              value={form.sourceReference}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sourceReference: e.target.value }))
              }
            />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Descrizione</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isActive}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, isActive: checked }))
              }
            />
            Attiva
          </label>
          <div className="sm:col-span-2">
            <Button
              onClick={() => {
                if (!userId || !form.companyId) {
                  toast.error("Seleziona una società");
                  return;
                }
                void createPolicy({
                  actorUserId: userId,
                  companyId: form.companyId as Id<"financialCompanies">,
                  productId: form.productId
                    ? (form.productId as Id<"financialProducts">)
                    : undefined,
                  financialTableId: form.financialTableId
                    ? (form.financialTableId as Id<"financialTables">)
                    : undefined,
                  network: form.network,
                  name: form.name,
                  description: form.description || undefined,
                  sourceReference: form.sourceReference || undefined,
                  isActive: form.isActive,
                })
                  .then((id) => {
                    toast.success("Policy creata");
                    setForm({
                      companyId: "",
                      productId: "",
                      financialTableId: "",
                      network: "PCG",
                      name: "",
                      description: "",
                      sourceReference: "",
                      isActive: true,
                    });
                    return id;
                  })
                  .catch((error: unknown) =>
                    toast.error(
                      error instanceof Error ? error.message : "Creazione non riuscita",
                    ),
                  );
              }}
            >
              Crea policy
            </Button>
          </div>
        </CardContent>
      </Card>

      {policies.length === 0 ? (
        <EmptyState
          title="Nessuna policy"
          description="Crea una policy collegata a società, prodotto o tabella."
        />
      ) : (
        <div className="space-y-2">
          {policies.map((policy) => (
            <div
              key={policy._id}
              className="flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{policy.name}</p>
                  <ActiveBadge active={policy.isActive} />
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {policy.network}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    v{policy.version}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {policy.company?.name ?? "—"} ·{" "}
                  {policy.product?.name ?? "tutti i prodotti"} ·{" "}
                  {policy.financialTable?.tableCode ?? "tutte le tabelle"} ·{" "}
                  {policy.ruleCount} regole
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/admin/policy/${policy._id}`}>Apri regole</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!userId) return;
                    void setActive({
                      actorUserId: userId,
                      policySetId: policy._id,
                      isActive: !policy.isActive,
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
                  {policy.isActive ? "Disattiva" : "Attiva"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
