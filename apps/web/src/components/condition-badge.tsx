import { Badge } from "@proj/ui/components/badge";
import { type AssetCondition, conditionLabel } from "@/lib/assessments";

export function ConditionBadge({
  condition,
}: {
  condition?: AssetCondition | null;
}) {
  return (
    <Badge
      className="condition-badge"
      data-condition={condition ?? "UNASSESSED"}
      variant="outline"
    >
      {condition ? conditionLabel[condition] : "Not assessed yet"}
    </Badge>
  );
}
