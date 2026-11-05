import { Badge } from "@proj/ui/components/badge";
import { type AssetCondition, conditionLabel } from "@/lib/assessments";

const variants = {
  GOOD: "default",
  NEEDS_ATTENTION: "secondary",
  FAULTY: "destructive",
} as const satisfies Record<AssetCondition, string>;

export function ConditionBadge({
  condition,
}: {
  condition?: AssetCondition | null;
}) {
  return (
    <Badge variant={condition ? variants[condition] : "outline"}>
      {condition ? conditionLabel[condition] : "Not assessed yet"}
    </Badge>
  );
}
