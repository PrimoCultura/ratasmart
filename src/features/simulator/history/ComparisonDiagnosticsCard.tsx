import type {
  AlternativeScenario,
  ComparisonDiagnostics,
} from "../../../../shared/alternative-diagnostics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ComparisonDiagnosticsCardProps = {
  diagnostics: ComparisonDiagnostics;
};

function alternativeLabel(item: AlternativeScenario): string {
  if (item.certainty === "deterministic") {
    return "Possibile alternativa";
  }
  return "Condizione da rivalutare";
}

function emptyEconomicMessage(diagnostics: ComparisonDiagnostics): string {
  const primary = diagnostics.primaryConstraint?.type;
  if (primary === "temporary_contract_expiry") {
    return "Con i dati attuali non esiste un prodotto disponibile con una durata sufficientemente breve per rispettare la scadenza del contratto.";
  }
  if (primary === "residence_permit_expiry") {
    return "Con i dati attuali non esiste un prodotto disponibile con una durata sufficientemente breve per rispettare la scadenza del permesso di soggiorno.";
  }
  return "Con i dati attuali non esiste un prodotto immediatamente disponibile che rispetti tutti i requisiti dichiarati.";
}

export function ComparisonDiagnosticsCard({
  diagnostics,
}: ComparisonDiagnosticsCardProps) {
  if (diagnostics.hasCompatibleSolutions) {
    return null;
  }

  const hasVerification = (diagnostics.verificationRequiredCount ?? 0) > 0;
  const title = hasVerification
    ? "Nessuna soluzione immediatamente compatibile"
    : "Nessuna soluzione disponibile";
  const subtitle = hasVerification
    ? "Alcune soluzioni richiedono una verifica dei requisiti."
    : "Con i dati attuali nessun piano rispetta tutti i requisiti.";

  const secondary = diagnostics.blockingConstraints.filter(
    (item) => item.type !== diagnostics.primaryConstraint?.type,
  );
  const economicAlternatives = diagnostics.nearestAlternatives.filter(
    (item) =>
      item.certainty === "deterministic" &&
      (item.type === "shorter_duration" ||
        item.type === "lower_amount" ||
        item.type === "lower_amount_and_shorter_duration"),
  );
  const conditional = diagnostics.nearestAlternatives.filter(
    (item) => item.certainty === "requires_verification",
  );
  const missingDataActions = diagnostics.informationalSuggestions.filter(
    (item) => item.type === "complete_missing_data",
  );
  const otherSuggestions = diagnostics.informationalSuggestions.filter(
    (item) => item.type !== "complete_missing_data",
  );

  return (
    <Card
      data-testid="comparison-diagnostics-card"
      className="border-amber-200 bg-amber-50/60"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {diagnostics.primaryConstraint ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Vincolo principale
            </p>
            <p className="font-medium">{diagnostics.primaryConstraint.label}</p>
            {diagnostics.primaryConstraint.value !== undefined ? (
              <p className="text-muted-foreground">
                Scadenza: {String(diagnostics.primaryConstraint.value)}
              </p>
            ) : null}
            <p>{diagnostics.primaryConstraint.reason}</p>
          </div>
        ) : null}

        {secondary.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Altri vincoli
            </p>
            {secondary.map((constraint) => (
              <div key={constraint.type} className="space-y-0.5">
                <p className="font-medium">{constraint.label}</p>
                {constraint.value !== undefined ? (
                  <p className="text-muted-foreground">
                    Scadenza: {String(constraint.value)}
                  </p>
                ) : null}
                <p>{constraint.reason}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Possibili strade da valutare
          </p>
          {missingDataActions.length > 0 ? (
            <ul className="list-disc space-y-2 pl-5">
              {missingDataActions.map((item) => (
                <li key={item.message}>
                  <span className="font-medium">Azione richiesta:</span>{" "}
                  {item.message}
                </li>
              ))}
            </ul>
          ) : economicAlternatives.length === 0 ? (
            <p>{emptyEconomicMessage(diagnostics)}</p>
          ) : (
            <ul className="list-disc space-y-2 pl-5">
              {economicAlternatives.map((item) => (
                <li key={`${item.type}-${item.tableCode}-${item.durationMonths}`}>
                  <span className="font-medium">{alternativeLabel(item)}:</span>{" "}
                  {item.explanation}
                </li>
              ))}
            </ul>
          )}
          {missingDataActions.length === 0 && conditional.length > 0 ? (
            <ul className="mt-2 list-disc space-y-2 pl-5">
              {conditional.map((item, index) => (
                <li key={`${item.type}-${item.durationMonths}-${index}`}>
                  <span className="font-medium">{alternativeLabel(item)}:</span>{" "}
                  {item.explanation}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {otherSuggestions.length > 0 ? (
          <div className="space-y-1 rounded-md border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            {otherSuggestions.map((item) => (
              <p key={`${item.type}-${item.message}`}>{item.message}</p>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
