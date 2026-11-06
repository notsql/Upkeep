import { useCallback } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { Pagination } from "@/components/table/pagination";
import type {
  MonitoredSensor,
  SensorReview,
  SensorView,
} from "@/lib/flatlined-sensors";
import { timeLabel } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-format";
import { SensorMonitoringTable } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-review-results/sensor-monitoring-table";

const PAGE_SIZE = 25;

function emptyMessage(
  active: boolean,
  hasReadings: boolean,
  view: SensorView,
  page: number
): { title: string; description?: string } {
  if (!active) {
    return {
      title: "Monitoring unavailable",
      description: "Estate inactive",
    };
  }
  if (page > 0) {
    return {
      title: "No device metrics on this page",
      description: "Go back a page",
    };
  }
  if (view === "ALL") {
    return {
      title: "No devices yet",
      description: "Devices on active assets appear here",
    };
  }
  if (!hasReadings) {
    return {
      title: "No device readings yet",
      description: "See All device metrics",
    };
  }
  return {
    title: "Nothing needs review",
    description: "Other metrics are under All device metrics",
  };
}

export function SensorReviewResults({
  data,
  fetching,
  page,
  view,
  canManage,
  onPageChange,
  onPause,
}: {
  data: SensorReview;
  fetching: boolean;
  page: number;
  view: SensorView;
  canManage: boolean;
  onPageChange: (page: number) => void;
  onPause: (sensor: MonitoredSensor) => void;
}) {
  const previousPage = useCallback(
    () => onPageChange(page - 1),
    [onPageChange, page]
  );
  const nextPage = useCallback(
    () => onPageChange(page + 1),
    [onPageChange, page]
  );
  return (
    <>
      <p className="text-muted-foreground text-sm">
        Checked{" "}
        <time dateTime={data.checkedAt}>{timeLabel(data.checkedAt)}</time>.
        Refreshes every 60 seconds while this page is visible.
      </p>
      {data.sensors.length ? (
        <SensorMonitoringTable
          canManage={canManage}
          onPause={onPause}
          sensors={data.sensors}
        />
      ) : (
        <EmptyState
          {...emptyMessage(
            data.estateActive,
            data.hasSensorReadings,
            view,
            page
          )}
        />
      )}
      <Pagination
        canNext={(page + 1) * PAGE_SIZE < data.totalElements}
        canPrevious={page > 0}
        disabled={fetching}
        label="Device metric pages"
        onNext={nextPage}
        onPrevious={previousPage}
        summary={`Page ${page + 1} · ${data.totalElements} device metrics`}
      />
    </>
  );
}
