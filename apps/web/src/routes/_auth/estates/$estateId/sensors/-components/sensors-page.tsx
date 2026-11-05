import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Gauge } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { ListPageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { Pagination } from "@/components/pagination";
import { SectionCard } from "@/components/section-card";
import { SubNav } from "@/components/sub-nav";
import {
  type MonitoredSensor,
  type SensorReview,
  type SensorView,
  useFlatlinePolicies,
  useFlatlineReview,
} from "@/lib/flatlined-sensors";
import { MetricPolicySettings } from "@/routes/_auth/estates/$estateId/sensors/-components/metric-policy-settings";
import { PauseSensorDialog } from "@/routes/_auth/estates/$estateId/sensors/-components/pause-sensor-dialog";
import { timeLabel } from "@/routes/_auth/estates/$estateId/sensors/-components/sensor-format";
import { SensorMonitoringTable } from "@/routes/_auth/estates/$estateId/sensors/-components/sensor-monitoring-table";

const PAGE_SIZE = 25;

/** The frame shared by both device metric views: header, note and SubNav. */
export function SensorsLayout({
  estateId,
  children,
}: {
  estateId: string;
  children: ReactNode;
}) {
  return (
    <PageLayout className="min-w-0">
      <ListPageHeader
        description="Flatline review, policies and pauses"
        icon={Gauge}
        title="Device monitoring"
      />
      <p className="text-muted-foreground mb-5 text-sm">
        A possible flatline means a device kept sending nearly unchanged values.
        It needs review; it does not prove the device or asset is faulty.
        Silence does not count as unchanged readings.
      </p>
      <SubNav
        items={[
          {
            exact: true,
            label: "Needs review",
            params: { estateId },
            to: "/estates/$estateId/sensors",
          },
          {
            label: "All device metrics",
            params: { estateId },
            to: "/estates/$estateId/sensors/all",
          },
        ]}
        label="Device metric views"
      />
      {children}
    </PageLayout>
  );
}

/** One device metric view (needs review, or all), then the metric policies. */
export function SensorsView({
  estateId,
  view,
}: {
  estateId: string;
  view: SensorView;
}) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<MonitoredSensor>();
  const policies = useFlatlinePolicies(estateId);
  const review = useFlatlineReview(estateId, view, page);
  const canManage = Boolean(
    policies.data?.canManage &&
      policies.data.estateActive &&
      review.data?.canManage &&
      review.data.estateActive &&
      !review.error
  );
  const { refetch: refetchPolicies } = policies;
  const { refetch: refetchReview } = review;
  const refreshPolicies = useCallback(
    () => refetchPolicies(),
    [refetchPolicies]
  );
  const refreshReview = useCallback(() => refetchReview(), [refetchReview]);
  const closePause = useCallback(() => setSelected(undefined), []);
  if (policies.isPending) {
    return <LoadingState label="Loading metric policies…" rows={2} />;
  }
  if (policies.error) {
    return (
      <ErrorState
        message={policies.error.message}
        onRetry={refreshPolicies}
        retryLabel="Retry metric policies"
      />
    );
  }
  return (
    <div className="grid min-w-0 gap-6">
      {policies.data.estateActive ? null : (
        <Alert>
          <AlertDescription>
            This estate is inactive. Metric policies remain available to view.
          </AlertDescription>
        </Alert>
      )}
      <SectionCard
        actions={
          <Button
            disabled={review.isFetching}
            onClick={refreshReview}
            variant="outline"
          >
            Refresh readings
          </Button>
        }
        className="min-w-0"
        title="Device metrics"
      >
        <div className="grid min-w-0 gap-4">
          {review.isPending ? (
            <LoadingState label="Loading device metrics…" variant="table" />
          ) : null}
          {review.error ? (
            <ErrorState
              message={review.error.message}
              onRetry={refreshReview}
              retryLabel="Retry device metrics"
            />
          ) : null}
          {review.data && !review.error ? (
            <SensorReviewResults
              canManage={canManage}
              data={review.data}
              fetching={review.isFetching}
              onPageChange={setPage}
              onPause={setSelected}
              page={page}
              view={view}
            />
          ) : null}
        </div>
      </SectionCard>
      <MetricPolicySettings
        canManage={canManage}
        estateId={estateId}
        policies={policies.data.policies}
      />
      {selected && canManage ? (
        <PauseSensorDialog
          estateId={estateId}
          onClose={closePause}
          sensor={selected}
        />
      ) : null}
    </div>
  );
}

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

function SensorReviewResults({
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
