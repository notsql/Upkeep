import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import type {
  EstateReportFilters,
  useEstateReportLocations,
} from "@/lib/estate-reports";
import { ReportFilters } from "@/routes/_auth/estates/$estateId/reports/-components/report-filters/report-filters";

export function EstateReportsLocations({
  locations,
  filters,
  onChange,
  onRetry,
  barProps,
}: {
  locations: ReturnType<typeof useEstateReportLocations>;
  filters: EstateReportFilters;
  onChange: (values: EstateReportFilters) => void;
  onRetry: () => void;
  barProps: {
    id: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
}) {
  const { blockId, minLevelPosition, maxLevelPosition } = filters;
  return (
    <>
      {locations.data ? (
        <ReportFilters
          filters={filters}
          key={`${blockId ?? "all"}:${minLevelPosition ?? ""}:${maxLevelPosition ?? ""}`}
          locations={locations.data}
          onChange={onChange}
          showQueueView
          {...barProps}
        />
      ) : null}
      {locations.isPending ? (
        <LoadingState label="Loading locations…" rows={1} />
      ) : null}
      {locations.isError ? (
        <ErrorState
          message="Couldn't load locations. Try again."
          onRetry={onRetry}
          retryLabel="Retry locations"
        />
      ) : null}
    </>
  );
}
