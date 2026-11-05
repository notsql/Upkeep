import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@proj/ui/components/tabs";
import { Activity } from "lucide-react";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
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
  const changeView = useCallback((value: unknown) => {
    if (value === "REVIEW" || value === "ALL") {
      setView(value);
      setPage(0);
    }
  }, []);
  return (
    <PageLayout className="min-w-0">
      <PageHeader
        description="Review device readings and manage metric policies and maintenance pauses."
        title="Device monitoring"
      />
      <p className="text-muted-foreground my-4">
        Each row tracks one device and metric. A possible flatline means the
        device kept sending nearly unchanged values. It needs review; it does
        not prove the device or asset is faulty. Silence does not count as
        unchanged readings.
      </p>
      {policies.isPending ? (
        <LoadingState label="Loading metric policies…" rows={2} />
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
            <h2 className="text-lg font-semibold" id="monitoring-title">
              Device metrics
            </h2>
            <Tabs onValueChange={changeView} value={view}>
              <div className="flex flex-wrap items-center gap-3">
                <TabsList aria-label="Device metric view">
                  <TabsTrigger value="REVIEW">Needs review</TabsTrigger>
                  <TabsTrigger value="ALL">All device metrics</TabsTrigger>
                </TabsList>
                <Button
                  disabled={review.isFetching}
                  onClick={refreshReview}
                  variant="outline"
                >
                  Refresh readings
                </Button>
              </div>
              {(["REVIEW", "ALL"] as const).map((value) => (
                <TabsContent
                  className="grid min-w-0 gap-4"
                  key={value}
                  value={value}
                >
                  {review.isPending ? (
                    <LoadingState
                      label="Loading device metrics…"
                      variant="table"
                    />
                  ) : null}
                  {review.error ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {review.error.message}
                      </AlertDescription>
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
                </TabsContent>
              ))}
            </Tabs>
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
    </PageLayout>
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
      title: "Monitoring is unavailable while this estate is inactive.",
    };
  }
  if (page > 0) {
    return {
      title: "No device metrics on this page",
      description: "Return to the previous page.",
    };
  }
  if (view === "ALL") {
    return {
      title: "No devices are registered on active assets in this estate.",
    };
  }
  if (!hasReadings) {
    return {
      title: "No device readings yet",
      description:
        "Use All device metrics to review devices and configure their metrics.",
    };
  }
  return {
    title: "No device metrics currently need review",
    description:
      "Unconfigured metrics and metrics without enough evidence are listed under All device metrics.",
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
          icon={Activity}
          {...emptyMessage(
            data.estateActive,
            data.hasSensorReadings,
            view,
            page
          )}
        />
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
