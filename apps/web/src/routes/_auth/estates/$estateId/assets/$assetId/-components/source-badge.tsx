import { Badge } from "@proj/ui/components/badge";
import type { AssetServiceInterval } from "@/lib/service-intervals";

const OVERRIDE_BADGE =
  "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200";

/** The source badge and the sentence explaining where the interval comes from. */
export function SourceBadge({ interval }: { interval: AssetServiceInterval }) {
  if (interval.source === "ASSET") {
    return (
      <Badge className={OVERRIDE_BADGE} variant="outline">
        Override
      </Badge>
    );
  }
  if (interval.source === "CATEGORY") {
    return <Badge variant="secondary">From category</Badge>;
  }
  return (
    <Badge className="text-muted-foreground" variant="outline">
      No interval
    </Badge>
  );
}
