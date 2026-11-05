import { Badge } from "@proj/ui/components/badge";
import type { InspectionCheck } from "@/lib/inspection-list";

const DUE_BADGE =
  "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200";

const DONE_BADGE =
  "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";

export function StatusBadge({ check }: { check: InspectionCheck }) {
  if (check.status === "OVERDUE") {
    return <Badge variant="destructive">Overdue</Badge>;
  }
  if (check.status === "DUE") {
    return (
      <Badge className={DUE_BADGE} variant="outline">
        Due
      </Badge>
    );
  }
  return (
    <Badge className={DONE_BADGE} variant="outline">
      {`Done · ${check.result?.outcome === "FAIL" ? "Fail" : "Pass"}`}
    </Badge>
  );
}
