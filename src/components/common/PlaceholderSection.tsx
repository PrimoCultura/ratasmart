import { PageHeader } from "@/components/common/PageHeader";

type PlaceholderSectionProps = {
  title: string;
  description: string;
};

export function PlaceholderSection({
  title,
  description,
}: PlaceholderSectionProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8">
        <p className="text-sm text-muted-foreground">
          Sezione predisposta per le fasi successive. Nessuna funzionalità
          operativa in questa versione.
        </p>
      </div>
    </div>
  );
}
