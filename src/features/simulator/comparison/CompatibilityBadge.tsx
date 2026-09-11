import { Badge } from "@/components/ui/badge";
import type { Doc } from "../../../../convex/_generated/dataModel";

type CompatibilityStatus =
  Doc<"simulationComparisonSolutions">["compatibilitySnapshot"]["status"];

type CompatibilityBadgeProps = {
  status: CompatibilityStatus;
  className?: string;
};

export function compatibilityStatusLabel(status: CompatibilityStatus): string {
  switch (status) {
    case "compatible":
      return "Compatibile";
    case "verification_required":
      return "Da verificare";
    case "not_compatible":
      return "Non compatibile";
  }
}

function statusVariant(
  status: CompatibilityStatus,
): "success" | "warning" | "outline" {
  if (status === "compatible") return "success";
  if (status === "verification_required") return "warning";
  return "outline";
}

export function CompatibilityBadge({
  status,
  className,
}: CompatibilityBadgeProps) {
  return (
    <Badge variant={statusVariant(status)} className={className}>
      {compatibilityStatusLabel(status)}
    </Badge>
  );
}
