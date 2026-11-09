import { Badge } from "@proj/ui/components/badge";
import { badgeVariantFor, lifecycleTone } from "@/lib/status-tone";

export function LifecycleStatusBadge({
  inactive,
  inactiveLabel,
}: {
  inactive: boolean;
  inactiveLabel: "Inactive" | "Retired";
}) {
  const tone = inactive
    ? lifecycleTone[inactiveLabel === "Retired" ? "RETIRED" : "INACTIVE"]
    : lifecycleTone.ACTIVE;
  return (
    <Badge role="status" variant={badgeVariantFor(tone)}>
      {inactive ? inactiveLabel : "Active"}
    </Badge>
  );
}
