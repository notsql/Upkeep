import { Badge } from "@proj/ui/components/badge";
import type { InspectionCheck } from "@/lib/inspection-list";
import { badgeVariantFor, inspectionCheckTone } from "@/lib/status-tone";

function label(check: InspectionCheck): string {
  if (check.status === "OVERDUE") {
    return "Overdue";
  }
  if (check.status === "DUE") {
    return "Due";
  }
  return `Done · ${check.result?.outcome === "FAIL" ? "Fail" : "Pass"}`;
}

export function StatusBadge({ check }: { check: InspectionCheck }) {
  const tone = inspectionCheckTone(check.status, check.result?.outcome);
  return <Badge variant={badgeVariantFor(tone)}>{label(check)}</Badge>;
}
