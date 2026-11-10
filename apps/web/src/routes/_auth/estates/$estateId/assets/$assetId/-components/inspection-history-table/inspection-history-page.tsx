import { Link } from "@tanstack/react-router";
import { ClipboardList, ListChecks, Plus } from "lucide-react";
import {
  PageSection,
  sectionActionClassName,
} from "@/components/page/section-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { LoadMore } from "@/components/table/load-more";
import { Pagination } from "@/components/table/pagination";
import { InspectionHistoryRecordsTable } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-table/inspection-history-records-table";
import { useInspectionHistoryPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-table/use-inspection-history-page";

export function InspectionHistoryPage({
  estateId,
  assetId,
  canCreate,
}: {
  estateId: string;
  assetId: string;
  /** The viewer may file inspections; shown only while everything is active. */
  canCreate: boolean;
}) {
  const {
    active,
    asset,
    cursors,
    feed,
    history,
    mobile,
    next,
    nextCursor,
    previous,
    retry,
    workAccess,
  } = useInspectionHistoryPage(estateId, assetId);

  return (
    <PageSection
      actions={
        canCreate && active ? (
          <Link
            className={sectionActionClassName}
            params={{ estateId, assetId }}
            to="/estates/$estateId/assets/$assetId/inspections/new"
          >
            <Plus aria-hidden="true" />
            New inspection
          </Link>
        ) : undefined
      }
      icon={ListChecks}
      title="Inspection records"
    >
      <div className="min-w-0 space-y-4">
        {history.isPending ? (
          <LoadingState label="Loading inspection records…" rows={2} />
        ) : null}
        {history.isError ? (
          <ErrorState
            message={
              history.error?.message ?? "Inspection history is unavailable."
            }
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
            icon={ClipboardList}
            title="No inspection records yet"
          />
        ) : null}
        {asset.data && !active ? (
          <p role="note">
            New work orders are unavailable while the estate, asset or location
            is inactive or retired.
          </p>
        ) : null}
        {mobile && history.data?.items.length ? (
          <LoadMore {...feed.more} />
        ) : null}
        {!mobile && (history.data?.items.length || cursors.length > 1) ? (
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
    </PageSection>
  );
}
