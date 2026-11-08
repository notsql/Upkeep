import { Badge } from "@proj/ui/components/badge";
import { statusToneClassName } from "@/lib/status-tone";

export function LifecycleStatusBadge({
  inactive,
  inactiveLabel,
}: {
  inactive: boolean;
  inactiveLabel: "Inactive" | "Retired";
}) {
  return (
    <Badge
      className={statusToneClassName[inactive ? "danger" : "success"]}
      role="status"
      variant="outline"
    >
      {inactive ? inactiveLabel : "Active"}
    </Badge>
  );
}
