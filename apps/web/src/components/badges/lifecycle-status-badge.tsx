import { Badge } from "@proj/ui/components/badge";

export function LifecycleStatusBadge({
  inactive,
  inactiveLabel,
}: {
  inactive: boolean;
  inactiveLabel: "Inactive" | "Retired";
}) {
  return (
    <Badge role="status" variant={inactive ? "destructive" : "default"}>
      {inactive ? inactiveLabel : "Active"}
    </Badge>
  );
}
