import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  CircleCheck,
  EyeOff,
  TriangleAlert,
} from "lucide-react";
import { SummaryCard } from "@/components/summary-card";
import type { EstateAssetCategory } from "@/lib/asset-categories";
import { INTERVAL_UNITS, type IntervalUnit } from "@/lib/service-intervals";

/** Counts per unit in use, e.g. "1 in months · 1 in years". */
function unitBreakdown(categories: EstateAssetCategory[]): string {
  const parts = Object.entries(INTERVAL_UNITS).flatMap(([unit, labels]) => {
    const count = categories.filter(
      (category) => category.serviceInterval?.unit === (unit as IntervalUnit)
    ).length;
    return count > 0 ? [`${count} in ${labels.many}`] : [];
  });
  return parts.length > 0 ? parts.join(" · ") : "None yet";
}

/** Flag and service-interval insights above the Asset categories table (ID-83, ID-81). */
export function CategorySummaryCards({
  categories,
  estateId,
}: {
  categories: EstateAssetCategory[];
  estateId: string;
}) {
  const flagged = categories.filter((category) => category.failsSilently);
  const missing = categories.filter((category) => !category.serviceInterval);
  const set = categories.length - missing.length;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard icon={EyeOff} title="Fails silently" value={flagged.length}>
        <p className="text-muted-foreground text-sm">
          Categories flagged for spot checks
        </p>
      </SummaryCard>
      <SummaryCard
        icon={missing.length > 0 ? TriangleAlert : CircleCheck}
        title="Missing service interval"
        value={missing.length}
        warning={missing.length > 0}
      >
        {missing.length > 0 ? (
          <>
            <p className="text-muted-foreground text-sm">
              {`${missing.length} of ${categories.length} categories need an interval`}
            </p>
            <Link
              className={buttonVariants({
                className: "justify-self-start",
                size: "sm",
                variant: "outline",
              })}
              params={{ estateId, interval: "not-set" }}
              to="/estates/$estateId/asset-categories/$interval"
            >
              Show these categories
            </Link>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Every category has an interval.
          </p>
        )}
      </SummaryCard>
      <SummaryCard icon={CalendarClock} title="Intervals set" value={set}>
        <p className="text-muted-foreground text-sm">
          {unitBreakdown(categories)}
        </p>
      </SummaryCard>
    </div>
  );
}
