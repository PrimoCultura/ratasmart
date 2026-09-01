import { Badge } from "@/components/ui/badge";

type ProposedSolutionBadgeProps = {
  className?: string;
};

export function ProposedSolutionBadge({ className }: ProposedSolutionBadgeProps) {
  return (
    <Badge variant="success" className={className}>
      Soluzione proposta al paziente
    </Badge>
  );
}
