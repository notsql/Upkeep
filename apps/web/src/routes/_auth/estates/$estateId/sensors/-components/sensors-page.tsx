import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/page-header";
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

export function SensorsPage({ estateId }: { estateId: string }) {
  const [view, setView] = useState<SensorView>("REVIEW");
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
  const changeView = useCallback((value: string | null) => {
    if (value === "REVIEW" || value === "ALL") {
      setView(value);
      setPage(0);
    }
  }, []);
  return (
    <main className="page-layout min-w-0">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          { label: "Estate", to: "/estates/$estateId", params: { estateId } },
          { label: "Device monitoring" },
        ]}
        description="Review device readings and manage metric policies and maintenance pauses."
        title="Device monitoring"
      />
      <p className="my-4 text-muted-foreground">
        Each row tracks one device and metric. A possible flatline means the
        device kept sending nearly unchanged values. It needs review; it does
        not prove the device or asset is faulty. Silence does not count as
        unchanged readings.
      </p>
      {policies.isPending ? (
        <p role="status">Loading metric policies…</p>
      ) : null}
      {policies.error ? (
        <Alert variant="destructive">
          <AlertDescription>{policies.error.message}</AlertDescription>
          <Button onClick={refreshPolicies} variant="outline">
            Retry metric policies
          </Button>
        </Alert>
      ) : null}
      {policies.data && !policies.error ? (
        <>
          {policies.data.estateActive ? null : (
            <Alert>
              <AlertDescription>
                This estate is inactive. Metric policies remain available to
                view.
              </AlertDescription>
            </Alert>
          )}
          <section
            aria-labelledby="monitoring-title"
            className="my-6 grid min-w-0 gap-4"
          >
            <h2 className="font-semibold text-lg" id="monitoring-title">
              Device metrics
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <Select onValueChange={changeView} value={view}>
                <SelectTrigger
                  aria-label="Device metric view"
                  className="w-full sm:w-44"
                >
                  <SelectValue>
                    {view === "REVIEW" ? "Needs review" : "All device metrics"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REVIEW">Needs review</SelectItem>
                  <SelectItem value="ALL">All device metrics</SelectItem>
                </SelectContent>
              </Select>
              <Button
                disabled={review.isFetching}
                onClick={refreshReview}
                variant="outline"
              >
                Refresh readings
              </Button>
            </div>
            {review.isPending ? (
              <p role="status">Loading device metrics…</p>
            ) : null}
            {review.error ? (
              <Alert variant="destructive">
                <AlertDescription>{review.error.message}</AlertDescription>
                <Button onClick={refreshReview} variant="outline">
                  Retry device metrics
                </Button>
              </Alert>
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
          </section>
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
        </>
      ) : null}
    </main>
  );
}

function emptyMessage(
  active: boolean,
  hasReadings: boolean,
  view: SensorView,
  page: number
): string {
  if (!active) {
    return "Monitoring is unavailable while this estate is inactive.";
  }
  if (page > 0) {
    return "No device metrics on this page. Return to the previous page.";
  }
  if (view === "ALL") {
    return "No devices are registered on active assets in this estate.";
  }
  if (!hasReadings) {
    return "No device readings yet. Use All device metrics to review devices and configure their metrics.";
  }
  return "No device metrics currently need review. Unconfigured metrics and metrics without enough evidence are listed under All device metrics.";
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
        <p className="py-6 text-muted-foreground text-sm">
          {emptyMessage(data.estateActive, data.hasSensorReadings, view, page)}
        </p>
      )}
      <nav
        aria-label="Device metric pages"
        className="flex flex-wrap items-center gap-3"
      >
        <Button
          disabled={page === 0 || fetching}
          onClick={previousPage}
          variant="outline"
        >
          Previous page
        </Button>
        <p>
          Page {page + 1} · {data.totalElements} device metrics
        </p>
        <Button
          disabled={(page + 1) * 25 >= data.totalElements || fetching}
          onClick={nextPage}
          variant="outline"
        >
          Next page
        </Button>
      </nav>
    </>
  );
}
