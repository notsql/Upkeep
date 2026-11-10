import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Tags } from "lucide-react";
import { ServiceIntervalDialog } from "@/components/service-intervals/service-interval-dialog";
import { EmptyState } from "@/components/states/empty-state";
import { CheckSchedulesTable } from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/check-schedules-page/check-schedules-table";
import { SilentFailureDialog } from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/check-schedules-page/silent-failure-dialog";
import { useCheckSchedulesList } from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/check-schedules-page/use-check-schedules-list";
import {
  INTERVAL_SLUGS,
  type IntervalFilter,
} from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/interval-filter";

/** The filter a `/inspections/schedules/$interval` segment names, if any. */
export function intervalFilterFor(slug: string): IntervalFilter | undefined {
  return (Object.keys(INTERVAL_SLUGS) as Exclude<IntervalFilter, "ALL">[]).find(
    (filter) => INTERVAL_SLUGS[filter] === slug
  );
}

/** The categories table for one interval view, with its dialogs. */
export function CheckSchedulesList({
  estateId,
  filter,
}: {
  estateId: string;
  filter: IntervalFilter;
}) {
  const list = useCheckSchedulesList(estateId, filter);
  const { data, shown, flagging, editing } = list;
  if (!(data && shown)) {
    return null;
  }
  return (
    <>
      {data.estateActive ? null : (
        <p className="text-muted-foreground" role="note">
          This estate is inactive, so its check schedules can&apos;t be changed.
        </p>
      )}
      {shown.length === 0 ? (
        <EmptyState
          action={
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={{ estateId }}
              to="/estates/$estateId/inspections/schedules"
            >
              Clear filters
            </Link>
          }
          description="No equipment is checked this often."
          fill
          icon={Tags}
          title="Nothing here"
        />
      ) : (
        <CheckSchedulesTable
          categories={shown}
          disabled={!data.estateActive || list.pending}
          onEditInterval={list.setEditing}
          onToggleFlag={list.openFlag}
        />
      )}
      {flagging ? (
        <SilentFailureDialog
          category={flagging}
          error={list.error}
          onCancel={list.closeFlag}
          onConfirm={list.confirmFlag}
          pending={list.pending}
        />
      ) : null}
      {editing ? (
        <ServiceIntervalDialog
          description={`How often the manufacturer says ${editing.label.toLowerCase()} assets should be serviced. Assets can override it.`}
          interval={editing.serviceInterval ?? null}
          onCancel={list.closeInterval}
          onSave={list.saveEditing}
          title={`How often to service ${editing.label}`}
        />
      ) : null}
    </>
  );
}
