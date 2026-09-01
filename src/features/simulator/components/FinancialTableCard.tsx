import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCT_CATEGORY_LABELS } from "@/lib/constants/financial";
import { formatCurrency } from "@/lib/formatting/currency";
import {
  formatDelayDays,
  formatDurationRange,
  formatOpeningFee,
  formatPercent,
} from "@/lib/formatting/financial";
import { ManagerAuthorizationAlert } from "./ManagerAuthorizationAlert";
import { InternalMessageDialog } from "./InternalMessageDialog";
import type { Doc } from "../../../../convex/_generated/dataModel";

type TableWithRelations = Doc<"financialTables"> & {
  company: Doc<"financialCompanies"> | null;
  product: Doc<"financialProducts"> | null;
};

type Priority = Doc<"commercialPriorities">;
type InternalMessage = Doc<"internalMessages">;

type FinancialTableCardProps = {
  table: TableWithRelations;
  priority?: Priority;
  internalMessages: InternalMessage[];
};

export function FinancialTableCard({
  table,
  priority,
  internalMessages,
}: FinancialTableCardProps) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{table.displayName}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {table.company?.name ?? "—"} · {table.product?.name ?? "—"} ·{" "}
              {table.tableCode}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {PRODUCT_CATEGORY_LABELS[table.category]}
            </Badge>
            {priority ? (
              <Badge variant="success">Soluzione prioritaria aziendale</Badge>
            ) : null}
            {internalMessages.map((message) => (
              <InternalMessageDialog
                key={message._id}
                message={{
                  id: message._id,
                  title: message.title,
                  message: message.message,
                  messageType: message.messageType,
                  iconType: message.iconType,
                }}
              />
            ))}
          </div>
        </div>
        {priority?.visibleReason ? (
          <p className="text-xs text-muted-foreground">{priority.visibleReason}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <Info
            label="Importo"
            value={`${formatCurrency(table.minimumAmount)} – ${formatCurrency(table.maximumAmount)}`}
          />
          <Info
            label="Durate"
            value={formatDurationRange(
              table.minimumDurationMonths,
              table.maximumDurationMonths,
              table.durationStepMonths,
            )}
          />
          <Info label="TAN paziente" value={formatPercent(table.customerTanPercent)} />
          <Info
            label="Commissione apertura"
            value={formatOpeningFee(table.openingFeeType, table.openingFeeValue)}
          />
          <Info
            label="Spesa incasso rata"
            value={formatCurrency(table.collectionFeePerInstallment)}
          />
          <Info
            label="Prima rata"
            value={formatDelayDays(table.firstInstallmentDelayDays)}
          />
        </div>
        {table.requiresManagerAuthorizationNotice ? (
          <ManagerAuthorizationAlert />
        ) : null}
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
