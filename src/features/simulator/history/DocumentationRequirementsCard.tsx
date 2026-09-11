import { useState } from "react";
import type { DocumentationRequirements } from "../../../../shared/documentation-requirements";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  documentation: DocumentationRequirements;
};

function statusLabel(status: string): string {
  switch (status) {
    case "possible_exemption":
      return "Possibile esenzione";
    case "requires_verification":
      return "Da verificare";
    default:
      return "Documento richiesto";
  }
}

export function DocumentationRequirementsCard({ documentation }: Props) {
  const [open, setOpen] = useState(false);
  const income = documentation.incomeDocument;

  return (
    <Card
      data-testid="documentation-requirements-card"
      data-collapsed={open ? "false" : "true"}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
          data-testid="documentation-requirements-toggle"
          onClick={() => setOpen((value) => !value)}
        >
          <p className="text-sm font-medium">Documenti di reddito</p>
          <p className="truncate text-xs text-muted-foreground">{income.reason}</p>
        </button>
        <button
          type="button"
          className="shrink-0 text-xs font-medium text-muted-foreground"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Nascondi" : "Dettagli"}
        </button>
      </div>
      {open ? (
        <CardContent className="space-y-3 border-t pt-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Base soglia: €{income.thresholdBase.toLocaleString("it-IT")} (importo
            richiesto + spese finanziate). Soglia operativa: €
            {income.thresholdEur.toLocaleString("it-IT")}.
          </p>
          <ul className="space-y-2">
            {income.companies.map((company) => (
              <li
                key={company.companyShortName}
                className="rounded-md border px-3 py-2"
              >
                <p className="font-medium">
                  {company.companyShortName} — {statusLabel(company.status)}
                </p>
                <p className="text-muted-foreground">{company.reason}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Requisito documentale operativo: non modifica il ranking né la
            compatibilità finanziaria.
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}
