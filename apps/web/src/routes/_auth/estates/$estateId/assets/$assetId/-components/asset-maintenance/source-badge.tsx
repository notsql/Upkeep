import { Badge } from "@proj/ui/components/badge";
import type { AssetServiceInterval } from "@/lib/service-intervals";
import { badgeVariantFor } from "@/lib/status-tone";

/** The source badge and the sentence explaining where the interval comes from. */
export function SourceBadge({ interval }: { interval: AssetServiceInterval }) {
  if (interval.source === "ASSET") {
    return <Badge variant={badgeVariantFor("warning")}>Override</Badge>;
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
