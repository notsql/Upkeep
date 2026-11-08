import { urgencyLabels } from "@/components/reports/urgency-labels";
import type { EstateReport } from "@/lib/estate-reports";

export function LatestUrgencyChange({
  change,
}: {
  change: EstateReport["lastUrgencyChange"];
}) {
  if (!change) {
    return null;
  }
  return (
    <p className="text-muted-foreground text-sm wrap-anywhere">
      Urgency changed: {urgencyLabels[change.fromUrgency]} →{" "}
      {urgencyLabels[change.toUrgency]}
      {change.fromIsSafety === change.toIsSafety
        ? ""
        : ` · Safety: ${change.fromIsSafety ? "Yes" : "No"} → ${change.toIsSafety ? "Yes" : "No"}`}
      {" · "}
      {change.changedByName ?? "Name unavailable"}
      {" · "}
      <time dateTime={change.changedAt}>
        {new Date(change.changedAt).toLocaleString()}
      </time>
    </p>
  );
}
