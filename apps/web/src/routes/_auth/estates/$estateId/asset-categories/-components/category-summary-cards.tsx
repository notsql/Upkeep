import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { cn } from "@proj/ui/lib/utils";
import {
  CalendarClock,
  CircleCheck,
  EyeOff,
  type LucideIcon,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import type { EstateAssetCategory } from "@/lib/asset-categories";
import { INTERVAL_UNITS, type IntervalUnit } from "@/lib/service-intervals";

function SummaryCard({
  title,
  value,
  icon: Icon,
  warning = false,
  children,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  warning?: boolean;
  children: ReactNode;
}) {
  return (
    <Card
      aria-label={title}
      className={cn(
        "h-full gap-3",
        warning &&
          "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
      )}
      role="region"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle>
          <h2 className="text-sm">{title}</h2>
        </CardTitle>
        <Icon
          aria-hidden="true"
          className={cn(
            "size-5 shrink-0",
            warning
              ? "text-amber-700 dark:text-amber-300"
              : "text-muted-foreground"
          )}
        />
      </CardHeader>
      <CardContent className="grid gap-2">
        <p className="font-semibold text-3xl tabular-nums">{value}</p>
        {children}
      </CardContent>
    </Card>
  );
}

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
  onShowMissing,
}: {
  categories: EstateAssetCategory[];
  onShowMissing: () => void;
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
            <Button
              className="justify-self-start"
              onClick={onShowMissing}
              size="sm"
              type="button"
              variant="outline"
            >
              Show these categories
            </Button>
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
