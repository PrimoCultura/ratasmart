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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { NETWORKS } from "@/lib/constants/app";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type ProductCategory,
} from "@/lib/constants/financial";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatPercent } from "@/lib/formatting/financial";
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

type NetworkFilter = "ALL" | "PCG" | "DES";
type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";

export function TablesPage() {
  const { userId } = useCurrentUser();
  const tables = useQuery(api.financialTables.listFinancialTablesAdmin);
  const companies = useQuery(api.financialCompanies.listFinancialCompanies);
  const setActive = useMutation(api.financialTables.setFinancialTableActive);
  const seedAgosPcg = useMutation(api.seed.seedAgosPcg2026);
  const seedDeutscheBankPcg = useMutation(api.seed.seedDeutscheBankPcg2026);
  const seedCompassPcg = useMutation(api.seed.seedCompassPcg2026);

  const [search, setSearch] = useState("");
  const [network, setNetwork] = useState<NetworkFilter>("ALL");
  const [companyId, setCompanyId] = useState<string>("ALL");
  const [category, setCategory] = useState<"ALL" | ProductCategory>("ALL");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("ALL");
  const [seeding, setSeeding] = useState(false);

  const filtered = useMemo(() => {
    if (!tables) return [];
    const q = search.trim().toLowerCase();
    return tables.filter((table) => {
      if (network !== "ALL" && table.network !== network) return false;
      if (companyId !== "ALL" && table.companyId !== companyId) return false;
      if (category !== "ALL" && table.category !== category) return false;
      if (activeFilter === "ACTIVE" && !table.isActive) return false;
      if (activeFilter === "INACTIVE" && table.isActive) return false;
      if (!q) return true;
      return (
        table.tableCode.toLowerCase().includes(q) ||
        table.displayName.toLowerCase().includes(q)
      );
    });
  }, [tables, search, network, companyId, category, activeFilter]);

  if (tables === undefined || companies === undefined) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tabelle finanziarie"
        description="Condizioni economiche versionabili per rete PCG/DES. Le modifiche rilevanti creano una nuova versione."
        actions={
          <div className="flex flex-wrap gap-2">
            <SeedButton
              label="Carica configurazione Agos PCG 2026"
              title="Caricare Agos PCG 2026?"
              description="Verranno create le tabelle Agos PCG configurate per RataSmart. Le versioni storiche già utilizzate non verranno eliminate."
              disabled={!userId || seeding}
              onConfirm={() => {
                if (!userId) return;
                setSeeding(true);
                void seedAgosPcg({ actorUserId: userId })
                  .then((summary) => {
                    toast.success(
                      `Agos PCG: +${summary.created.length} create, ${summary.updatedOrVersioned.length} versionate, ${summary.skipped.length} skip, ${summary.deactivated.length} disattivate`,
                    );
                    if (summary.warnings.length > 0) {
                      toast.message(summary.warnings.join(" · "));
                    }
                  })
                  .catch((error: unknown) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Seed non riuscito",
                    ),
                  )
                  .finally(() => setSeeding(false));
              }}
            />
            <SeedButton
              label="Carica configurazione Deutsche Bank PCG 2026"
              title="Caricare Deutsche Bank PCG 2026?"
              description="Verranno create le tabelle Deutsche Bank PCG (SJ=, MUE, S/U, S8L). Le versioni storiche già utilizzate non verranno eliminate."
              disabled={!userId || seeding}
              onConfirm={() => {
                if (!userId) return;
                setSeeding(true);
                void seedDeutscheBankPcg({ actorUserId: userId })
                  .then((summary) => {
                    toast.success(
                      `DB PCG: +${summary.created.length} create, ${summary.updatedOrVersioned.length} versionate, ${summary.skipped.length} skip`,
                    );
                    if (summary.warnings.length > 0) {
                      toast.message(summary.warnings.join(" · "));
                    }
                  })
                  .catch((error: unknown) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Seed non riuscito",
                    ),
                  )
                  .finally(() => setSeeding(false));
              }}
            />
            <SeedButton
              label="Carica configurazione Compass PCG 2026"
              title="Caricare Compass PCG 2026?"
              description="Verranno create le tabelle Compass PCG (81K, NE9). Le versioni storiche già utilizzate non verranno eliminate."
              disabled={!userId || seeding}
              onConfirm={() => {
                if (!userId) return;
                setSeeding(true);
                void seedCompassPcg({ actorUserId: userId })
                  .then((summary) => {
                    toast.success(
                      `Compass PCG: +${summary.created.length} create, ${summary.updatedOrVersioned.length} versionate, ${summary.skipped.length} skip`,
                    );
                    if (summary.warnings.length > 0) {
                      toast.message(summary.warnings.join(" · "));
                    }
                  })
                  .catch((error: unknown) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Seed non riuscito",
                    ),
                  )
                  .finally(() => setSeeding(false));
              }}
            />
            <Button asChild>
              <Link to="/admin/tabelle/nuova">Nuova tabella</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="Cerca codice o nome"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={network} onValueChange={(v) => setNetwork(v as NetworkFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="Rete" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutte le reti</SelectItem>
            {NETWORKS.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={companyId} onValueChange={setCompanyId}>
          <SelectTrigger>
            <SelectValue placeholder="Finanziaria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutte le finanziarie</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company._id} value={company._id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as "ALL" | ProductCategory)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutte le categorie</SelectItem>
            {PRODUCT_CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>
                {PRODUCT_CATEGORY_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={activeFilter}
          onValueChange={(v) => setActiveFilter(v as ActiveFilter)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutti gli stati</SelectItem>
            <SelectItem value="ACTIVE">Attive</SelectItem>
            <SelectItem value="INACTIVE">Non attive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nessuna tabella trovata"
          description="Modifica i filtri oppure crea una nuova tabella."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((table) => (
            <div
              key={table._id}
              className="flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{table.displayName}</p>
                  <ActiveBadge active={table.isActive} />
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {table.network}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    v{table.version}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {table.company?.name ?? "—"} · {table.product?.name ?? "—"} ·{" "}
                  {table.tableCode} · {PRODUCT_CATEGORY_LABELS[table.category]} ·{" "}
                  {formatCurrency(table.minimumAmount)}–
                  {formatCurrency(table.maximumAmount)} · TAN{" "}
                  {formatPercent(table.customerTanPercent)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/admin/tabelle/${table._id}`}>Visualizza</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/admin/tabelle/${table._id}/nuova-versione`}>
                    Nuova versione
                  </Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost">
                      {table.isActive ? "Disattiva" : "Attiva"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {table.isActive ? "Disattivare" : "Attivare"} la tabella?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Le tabelle versionate non vengono cancellate: preferiamo
                        attivazione/disattivazione.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          if (!userId) return;
                          void setActive({
                            actorUserId: userId,
                            tableId: table._id as Id<"financialTables">,
                            isActive: !table.isActive,
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
                        Conferma
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SeedButton({
  label,
  title,
  description,
  disabled,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction disabled={disabled} onClick={onConfirm}>
            Conferma
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
