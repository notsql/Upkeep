import { Badge } from "@proj/ui/components/badge";

export function LifecycleStatusBadge({
  inactive,
  inactiveLabel,
}: {
  inactive: boolean;
  inactiveLabel: "Inactive" | "Retired";
}) {
  return (
    <Badge
      className="lifecycle-status-badge"
      data-state={inactive ? "inactive" : "active"}
      role="status"
      variant="secondary"
    >
      {inactive ? inactiveLabel : "Active"}
    </Badge>
  );
}
