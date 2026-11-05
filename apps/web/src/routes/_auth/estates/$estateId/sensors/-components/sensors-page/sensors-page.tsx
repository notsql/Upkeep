import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { useCallback, useState } from "react";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import {
  type MonitoredSensor,
  type SensorView,
  useFlatlinePolicies,
  useFlatlineReview,
} from "@/lib/flatlined-sensors";
import { MetricPolicySettings } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/metric-policy-settings/metric-policy-settings";
import { PauseSensorDialog } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/pause-sensor-dialog";
import { SensorsDeviceMetrics } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensors-device-metrics";

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
      <SensorsDeviceMetrics
        canManage={canManage}
        onPageChange={setPage}
        onPause={setSelected}
        onRefresh={refreshReview}
        page={page}
        review={review}
        view={view}
      />
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
