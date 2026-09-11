import type { DocumentationRequirements } from "../../../../shared/documentation-requirements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const income = documentation.incomeDocument;
  return (
    <Card data-testid="documentation-requirements-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Documenti di reddito</CardTitle>
        <p className="text-sm text-muted-foreground">{income.reason}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Base soglia: €{income.thresholdBase.toLocaleString("it-IT")} (importo
          richiesto + spese finanziate). Soglia operativa: €
          {income.thresholdEur.toLocaleString("it-IT")}.
        </p>
        <ul className="space-y-2">
          {income.companies.map((company) => (
            <li key={company.companyShortName} className="rounded-md border px-3 py-2">
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
    </Card>
  );
}
