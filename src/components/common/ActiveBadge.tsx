import { Badge } from "@/components/ui/badge";

type ActiveBadgeProps = {
  active: boolean;
};

export function ActiveBadge({ active }: ActiveBadgeProps) {
  return (
    <Badge variant={active ? "success" : "secondary"}>
      {active ? "Attiva" : "Non attiva"}
    </Badge>
  );
}
