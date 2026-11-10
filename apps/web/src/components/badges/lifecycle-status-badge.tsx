import { Badge } from "@proj/ui/components/badge";
import { badgeVariantFor, lifecycleTone } from "@/lib/status-tone";

export function LifecycleStatusBadge({
  inactive,
  inactiveLabel,
}: {
  inactive: boolean;
  inactiveLabel: "Inactive" | "Out of use";
}) {
  const tone = inactive
    ? lifecycleTone[inactiveLabel === "Out of use" ? "RETIRED" : "INACTIVE"]
    : lifecycleTone.ACTIVE;
  return (
    <Badge role="status" variant={badgeVariantFor(tone)}>
      {inactive ? inactiveLabel : "Active"}
    </Badge>
  );
}
