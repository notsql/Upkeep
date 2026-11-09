import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  CircleCheck,
  CircleDashed,
  TriangleAlert,
} from "lucide-react";
import { SummaryCard } from "@/components/page/summary-card";
import type { InspectionList } from "@/lib/inspection-list";

export function SummaryCards({
  data,
  estateId,
}: {
  data: InspectionList;
  estateId: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        icon={TriangleAlert}
        title="Overdue"
        value={data.overdueCount}
        warning={data.overdueCount > 0}
      >
        <p className="text-muted-foreground text-sm">
          Missed in an earlier month
        </p>
      </SummaryCard>
      <SummaryCard
        icon={CalendarClock}
        title="Due this month"
        value={data.dueCount}
      >
        <p className="text-muted-foreground text-sm">Still to check</p>
      </SummaryCard>
      <SummaryCard
        icon={CircleCheck}
        title="Done this month"
        value={data.doneCount}
      >
        <p className="text-muted-foreground text-sm">Inspected this month</p>
      </SummaryCard>
      {data.unscheduled.length > 0 ? (
        <SummaryCard
          icon={CircleDashed}
          title="Not scheduled"
          value={data.unscheduled.length}
          warning
        >
          <p className="text-muted-foreground text-sm">
            Flagged assets with no service interval
          </p>
          <Link
            className={buttonVariants({
              className: "justify-self-start",
              size: "sm",
              variant: "outline",
            })}
            params={{ estateId }}
            to="/estates/$estateId/inspections/schedules"
          >
            Set check schedules
          </Link>
        </SummaryCard>
      ) : null}
    </div>
  );
}
