import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { Pagination } from "@/components/pagination";
import { SectionCard } from "@/components/section-card";
import { InspectionHistoryRecordsTable } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-records-table";
import { useInspectionHistoryPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/use-inspection-history-page";

export function InspectionHistoryPage({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const {
    active,
    asset,
    cursors,
    history,
    next,
    nextCursor,
    previous,
    retry,
    workAccess,
  } = useInspectionHistoryPage(estateId, assetId);

  return (
    <SectionCard
      className="max-w-full min-w-0"
      icon={ListChecks}
      title="Inspection records"
    >
      <div className="space-y-4">
        {history.isPending ? (
          <LoadingState label="Loading inspection records…" rows={2} />
        ) : null}
        {history.isError ? (
          <ErrorState
            message={history.error.message}
            onRetry={retry}
            retryLabel="Retry inspections"
          />
        ) : null}
        {history.data && history.data.items.length > 0 ? (
          <InspectionHistoryRecordsTable
            canCreateWorkOrder={workAccess.canCreate && active}
            canViewWorkOrder={workAccess.canView}
            records={history.data.items}
          />
        ) : null}
        {history.data?.items.length === 0 ? (
          <EmptyState
            description="Saved inspections appear here"
            title="No inspection records yet"
          />
        ) : null}
        {asset.data && !active ? (
          <p role="note">
            New work orders are unavailable while the estate, asset or location
            is inactive or retired.
          </p>
        ) : null}
        {history.data?.items.length || cursors.length > 1 ? (
          <Pagination
            canNext={Boolean(nextCursor)}
            canPrevious={cursors.length > 1}
            disabled={history.isFetching}
            label="Inspection history pages"
            onNext={next}
            onPrevious={previous}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
