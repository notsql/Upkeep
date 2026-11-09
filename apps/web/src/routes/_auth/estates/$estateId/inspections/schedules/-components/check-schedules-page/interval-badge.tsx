import { Badge } from "@proj/ui/components/badge";
import {
  formatInterval,
  type IntervalUnit,
  type ServiceInterval,
} from "@/lib/service-intervals";

// Colour only reinforces the unit, which the text always says.
const colours: Record<IntervalUnit, string> = {
  DAY: "border-brand-1/40 bg-brand-1/15 text-brand-3",
  MONTH: "border-brand-2/30 bg-brand-2/10 text-brand-2",
  YEAR: "border-brand-3/30 bg-brand-3/10 text-brand-3",
};

/** A service interval as a label coloured by its unit; "No schedule" stays plain (ID-81). */
export function IntervalBadge({
  interval,
}: {
  interval: ServiceInterval | null | undefined;
}) {
  if (!interval) {
    return (
      <Badge className="text-muted-foreground" variant="outline">
        No schedule
      </Badge>
    );
  }
  return (
    <Badge className={colours[interval.unit]} variant="outline">
      {formatInterval(interval)}
    </Badge>
  );
}
