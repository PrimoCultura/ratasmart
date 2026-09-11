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

export function ComparisonDiagnosticsCard({
  diagnostics,
}: ComparisonDiagnosticsCardProps) {
  if (diagnostics.hasCompatibleSolutions) {
    return null;
  }

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

  return (
    <Card
      data-testid="comparison-diagnostics-card"
      className="border-amber-200 bg-amber-50/60"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Nessuna soluzione disponibile</CardTitle>
        <p className="text-sm text-muted-foreground">
          Con i dati attuali nessun piano rispetta tutti i requisiti.
        </p>
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
          {economicAlternatives.length === 0 ? (
            <p>
              Con i dati attuali non esiste un prodotto disponibile con una
              durata sufficientemente breve per rispettare la scadenza del
              contratto.
            </p>
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
          {conditional.length > 0 ? (
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

        {diagnostics.informationalSuggestions.length > 0 ? (
          <div className="space-y-1 rounded-md border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            {diagnostics.informationalSuggestions.map((item) => (
              <p key={item.type}>{item.message}</p>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
