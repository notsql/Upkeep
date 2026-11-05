import { Badge } from "@proj/ui/components/badge";
import {
  formatInterval,
  type IntervalUnit,
  type ServiceInterval,
} from "@/lib/service-intervals";

// Colour only reinforces the unit, which the text always says.
const colours: Record<IntervalUnit, string> = {
  DAY: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  MONTH:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  YEAR: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200",
};

/** A service interval as a label coloured by its unit; "Not set" stays plain (ID-81). */
export function IntervalBadge({
  interval,
}: {
  interval: ServiceInterval | null | undefined;
}) {
  if (!interval) {
    return (
      <Badge className="text-muted-foreground" variant="outline">
        {formatInterval(interval)}
      </Badge>
    );
  }
  return (
    <Badge className={colours[interval.unit]} variant="outline">
      {formatInterval(interval)}
    </Badge>
  );
}
