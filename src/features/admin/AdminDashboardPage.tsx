import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatPercent } from "../../../shared/admin-analytics";

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return formatCurrency(value);
}

export function AdminDashboardPage() {
  const { userId } = useCurrentUser();
  const [periodDays, setPeriodDays] = useState("30");
  const [network, setNetwork] = useState<"ALL" | "PCG" | "DES" | "Paoleschi">(
    "ALL",
  );
  const [clinicName, setClinicName] = useState("ALL");
  const [companyId, setCompanyId] = useState("ALL");
  const [productId, setProductId] = useState("ALL");

  // Stabilizza gli argomenti Convex: Date.now() a ogni render
  // farebbe ripartire la query all'infinito → LoadingState permanente.
  const periodRange = useMemo(() => {
    const toMs = Date.now();
    return {
      toMs,
      fromMs: toMs - Number(periodDays) * 24 * 60 * 60 * 1000,
    };
  }, [periodDays]);

  const filterOptions = useQuery(
    api.adminAnalytics.listFilterOptions,
    userId ? { actorUserId: userId } : "skip",
  );
  const analytics = useQuery(
    api.adminAnalytics.getAdminDashboardAnalytics,
    userId
      ? {
          actorUserId: userId,
          fromMs: periodRange.fromMs,
          toMs: periodRange.toMs,
          network: network === "ALL" ? undefined : network,
          clinicName: clinicName === "ALL" ? undefined : clinicName,
          companyId: companyId === "ALL" ? undefined : companyId,
          productId: productId === "ALL" ? undefined : productId,
        }
      : "skip",
  );

  const products = useMemo(() => {
    if (!filterOptions) return [];
    if (companyId === "ALL") return filterOptions.products;
    return filterOptions.products.filter(
      (product) => product.companyId === companyId,
    );
  }, [filterOptions, companyId]);

  if (!userId) {
    return <LoadingState />;
  }

  if (analytics === undefined || filterOptions === undefined) {
    return <LoadingState />;
  }

  const { kpis, demand, productCoverage, topReasons, macroCategoryCounts, trend } =
    analytics;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Control Room"
        description="Governance e analytics aggregate. Nessun dato personale paziente in dashboard."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/utenti">Utenti</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/simulazioni">Simulazioni</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Select value={periodDays} onValueChange={setPeriodDays}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 giorni</SelectItem>
            <SelectItem value="30">30 giorni</SelectItem>
            <SelectItem value="90">90 giorni</SelectItem>
            <SelectItem value="180">180 giorni</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={network}
          onValueChange={(value) => setNetwork(value as typeof network)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutte le reti</SelectItem>
            <SelectItem value="PCG">PCG</SelectItem>
            <SelectItem value="DES">DES</SelectItem>
            <SelectItem value="Paoleschi">Paoleschi</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clinicName} onValueChange={setClinicName}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Clinica" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutte le cliniche</SelectItem>
            {filterOptions.clinics.map((clinic) => (
              <SelectItem key={clinic} value={clinic}>
                {clinic}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={companyId}
          onValueChange={(value) => {
            setCompanyId(value);
            setProductId("ALL");
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Finanziaria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutte le finanziarie</SelectItem>
            {filterOptions.companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Prodotto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutti i prodotti</SelectItem>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {analytics.empty ? (
        <EmptyState
          title="Nessun dato nel periodo"
          description="Prova a cambiare filtri o periodo."
        />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi
          label="1. Simulazioni"
          value={String(kpis.simulationsCreated)}
          hint={`Create nel periodo · confronti validi: ${kpis.comparisonsValid}`}
        />
        <Kpi
          label="2. Importo medio / mediano"
          value={`${formatMoney(kpis.averageRequestedAmount)} / ${formatMoney(kpis.medianRequestedAmount)}`}
        />
        <Kpi
          label="3. Utenti attivi"
          value={`${kpis.activeUsers} / ${kpis.totalUsers}`}
          hint={`${formatPercent(kpis.activeUsersRate)} del totale (con almeno un confronto)`}
        />
        <Kpi
          label="4. Coverage Rate"
          value={formatPercent(kpis.coverageRate)}
          hint="≥1 soluzione compatible / confronti validi"
        />
        <Kpi
          label="5. % No Solution"
          value={formatPercent(kpis.noSolutionRate)}
        />
        <Kpi
          label="6. % Verification Required"
          value={formatPercent(kpis.verificationRequiredRate)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">A. Utilizzo nel tempo</h2>
        {trend.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun trend.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Periodo</th>
                  <th className="px-3 py-2">Simulazioni</th>
                  <th className="px-3 py-2">Coverage</th>
                  <th className="px-3 py-2">No solution</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((row) => (
                  <tr key={row.bucket} className="border-b last:border-0">
                    <td className="px-3 py-2 tabular-nums">{row.bucket}</td>
                    <td className="px-3 py-2 tabular-nums">{row.simulations}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatPercent(row.coverageRate)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatPercent(row.noSolutionRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">B. Domanda finanziaria</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Importo medio" value={formatMoney(demand.averageRequestedAmount)} />
          <Kpi label="Importo mediano" value={formatMoney(demand.medianRequestedAmount)} />
          <Kpi
            label="Durata media selezionata"
            value={
              demand.averageSelectedDurationMonths == null
                ? "—"
                : `${demand.averageSelectedDurationMonths.toFixed(1)} mesi`
            }
          />
          <Kpi
            label="% richiesta tasso zero"
            value={formatPercent(demand.zeroInterestRequestRate)}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Distribuzione importi
            </p>
            <ul className="space-y-1 text-sm">
              {demand.amountBuckets.map((bucket) => (
                <li key={bucket.label} className="flex justify-between">
                  <span>{bucket.label}</span>
                  <span className="tabular-nums">{bucket.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Per network
            </p>
            <ul className="space-y-1 text-sm">
              {Object.entries(demand.networkCounts).map(([net, count]) => (
                <li key={net} className="flex justify-between">
                  <span>{net}</span>
                  <span className="tabular-nums">{count}</span>
                </li>
              ))}
              {Object.keys(demand.networkCounts).length === 0 ? (
                <li className="text-muted-foreground">Nessun dato</li>
              ) : null}
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">C. Copertura prodotti</h2>
        <p className="text-xs text-muted-foreground">
          Dato descrittivo: non indica automaticamente il “prodotto migliore”.
        </p>
        {productCoverage.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun prodotto valutato.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Prodotto</th>
                  <th className="px-3 py-2">Tabella</th>
                  <th className="px-3 py-2">OK</th>
                  <th className="px-3 py-2">Verif.</th>
                  <th className="px-3 py-2">No</th>
                  <th className="px-3 py-2">% OK</th>
                  <th className="px-3 py-2">Importo medio</th>
                </tr>
              </thead>
              <tbody>
                {productCoverage.map((row) => (
                  <tr
                    key={`${row.companyId}-${row.productId}-${row.tableCode}`}
                    className="border-b last:border-0"
                  >
                    <td className="px-3 py-2">{row.companyShortName}</td>
                    <td className="px-3 py-2">{row.productName}</td>
                    <td className="px-3 py-2">{row.tableCode}</td>
                    <td className="px-3 py-2 tabular-nums">{row.compatible}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.verificationRequired}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.notCompatible}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatPercent(row.compatibilityRate)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMoney(row.averageRequestedAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          D. Perché non troviamo una soluzione?
        </h2>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {(
            Object.entries(macroCategoryCounts) as Array<[string, number]>
          ).map(([key, count]) => (
            <span key={key} className="rounded border px-2 py-1">
              {key}: {count}
            </span>
          ))}
        </div>
        {topReasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessun motivo aggregato nel periodo (o solo esiti compatible).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Motivo</th>
                  <th className="px-3 py-2">Macro</th>
                  <th className="px-3 py-2">Casi</th>
                  <th className="px-3 py-2">%</th>
                  <th className="px-3 py-2">Importo medio</th>
                  <th className="px-3 py-2">Network</th>
                </tr>
              </thead>
              <tbody>
                {topReasons.map((row) => (
                  <tr key={row.ruleType} className="border-b last:border-0">
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2 text-xs">{row.macroCategory}</td>
                    <td className="px-3 py-2 tabular-nums">{row.count}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatPercent(row.percent)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMoney(row.averageAmount)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {Object.entries(row.networks)
                        .map(([net, count]) => `${net}:${count}`)
                        .join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export { AdminSimulationsPage } from "./simulations/AdminSimulationsPage";
