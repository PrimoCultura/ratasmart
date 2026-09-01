import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Network } from "@/lib/constants/app";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { FinancialTableCard } from "./FinancialTableCard";

type AvailableFinancialTablesProps = {
  network: Network;
};

export function AvailableFinancialTables({
  network,
}: AvailableFinancialTablesProps) {
  const tables = useQuery(api.financialTables.listActiveFinancialTables, {
    network,
  });
  const priorities = useQuery(api.commercialPriorities.listActiveCommercialPriorities, {
    network,
  });
  const messages = useQuery(api.internalMessages.listActiveInternalMessages, {
    network,
  });

  const sortedTables = useMemo(() => {
    if (!tables) return [];
    const priorityByTable = new Map(
      (priorities ?? [])
        .filter((item) => item.financialTableId)
        .map((item) => [item.financialTableId!, item]),
    );
    const priorityByCompany = new Map(
      (priorities ?? [])
        .filter((item) => item.companyId && !item.financialTableId)
        .map((item) => [item.companyId!, item]),
    );

    return [...tables].sort((a, b) => {
      const scoreA =
        priorityByTable.get(a._id)?.priorityScore ??
        priorityByCompany.get(a.companyId)?.priorityScore ??
        0;
      const scoreB =
        priorityByTable.get(b._id)?.priorityScore ??
        priorityByCompany.get(b.companyId)?.priorityScore ??
        0;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return a.displayName.localeCompare(b.displayName, "it");
    });
  }, [tables, priorities]);

  if (
    tables === undefined ||
    priorities === undefined ||
    messages === undefined
  ) {
    return <LoadingState label="Caricamento condizioni…" />;
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Condizioni disponibili</h2>
        <p className="text-sm text-muted-foreground">
          Anteprima condizioni – calcolo disponibile nella fase successiva · rete{" "}
          {network}
        </p>
      </div>

      {sortedTables.length === 0 ? (
        <EmptyState
          title="Nessuna tabella attiva"
          description={`Non ci sono condizioni attive per la rete ${network}.`}
        />
      ) : (
        <div className="space-y-3">
          {sortedTables.map((table) => {
            const priority =
              (priorities ?? []).find(
                (item) => item.financialTableId === table._id,
              ) ??
              (priorities ?? []).find(
                (item) =>
                  item.companyId === table.companyId && !item.financialTableId,
              );

            const relatedMessages = (messages ?? []).filter(
              (item) =>
                item.financialTableId === table._id ||
                (!item.financialTableId &&
                  (!item.companyId || item.companyId === table.companyId) &&
                  (!item.productId || item.productId === table.productId)),
            );

            return (
              <FinancialTableCard
                key={table._id}
                table={table}
                priority={priority}
                internalMessages={relatedMessages}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
