import { Button } from "@proj/ui/components/button";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { SectionCard } from "@/components/section-card";
import type {
  MonitoredSensor,
  SensorView,
  useFlatlineReview,
} from "@/lib/flatlined-sensors";
import { SensorReviewResults } from "./sensor-review-results";

export function SensorsDeviceMetrics({
  canManage,
  onPageChange,
  onPause,
  onRefresh,
  page,
  review,
  view,
}: {
  canManage: boolean;
  onPageChange: (page: number) => void;
  onPause: (sensor: MonitoredSensor) => void;
  onRefresh: () => void;
  page: number;
  review: ReturnType<typeof useFlatlineReview>;
  view: SensorView;
}) {
  return (
    <SectionCard
      actions={
        <Button
          disabled={review.isFetching}
          onClick={onRefresh}
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
            onRetry={onRefresh}
            retryLabel="Retry device metrics"
          />
        ) : null}
        {review.data && !review.error ? (
          <SensorReviewResults
            canManage={canManage}
            data={review.data}
            fetching={review.isFetching}
            onPageChange={onPageChange}
            onPause={onPause}
            page={page}
            view={view}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
