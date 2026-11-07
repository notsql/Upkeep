import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { useCallback, useMemo } from "react";
import { SectionCard } from "@/components/page/section-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useEstateReadings } from "@/lib/readings";
import { ReadingTable } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-table";

/** The asset's latest page of readings; filters and export live on its readings page. */
export function OverviewReadingsSection({
  assetId,
  canRecord,
  estateId,
}: {
  assetId: string;
  canRecord: boolean;
  estateId: string;
}) {
  const filters = useMemo(() => ({ assetId }), [assetId]);
  const readings = useEstateReadings(estateId, filters);
  const retry = useCallback(() => readings.refetch(), [readings.refetch]);
  return (
    <SectionCard
      actions={
        <>
          {canRecord ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={{ estateId, assetId }}
              to="/estates/$estateId/readings/$assetId/new"
            >
              Record manual reading
            </Link>
          ) : null}
          <Link
            className={buttonVariants({ variant: "outline" })}
            params={{ estateId, assetId }}
            to="/estates/$estateId/assets/$assetId/readings"
          >
            View all readings
          </Link>
        </>
      }
      description="The latest 50 readings, from sensors and manual entry."
      icon={Activity}
      title="Readings"
    >
      {readings.isPending ? (
        <LoadingState label="Loading readings…" variant="table" />
      ) : null}
      {readings.error ? (
        <ErrorState
          message={readings.error.message}
          onRetry={retry}
          retryLabel="Retry readings"
        />
      ) : null}
      {readings.data?.items.length === 0 ? (
        <EmptyState title="No readings yet" />
      ) : null}
      {readings.data?.items.length ? (
        <ReadingTable
          items={readings.data.items}
          refreshing={readings.isFetching}
        />
      ) : null}
    </SectionCard>
  );
}
