import { Button } from "@proj/ui/components/button";
import { History } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import {
  type HistoryDateFilters,
  type HistoryDocument,
  useAssetHistory,
  useAssetHistoryAccess,
} from "@/lib/asset-history";
import { HistoryDocumentDialog } from "./history-document-dialog";
import { HistoryTimelineEntry } from "./history-timeline-entry";

export function AssetHistoryPage({
  estateId,
  assetId,
  filters = {},
}: {
  estateId: string;
  assetId: string;
  filters?: HistoryDateFilters;
}) {
  const access = useAssetHistoryAccess(estateId);
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (access.error) {
    return (
      <p role="alert">
        Couldn't verify your access. Reload this page to try again.
      </p>
    );
  }
  if (!access.canView) {
    return <p role="alert">You do not have access to this asset’s history.</p>;
  }
  return (
    <HistoryTimeline
      assetId={assetId}
      estateId={estateId}
      filters={filters}
      key={`${access.userId}:${estateId}:${assetId}:${filters.from ?? ""}:${filters.to ?? ""}`}
    />
  );
}

function HistoryTimeline({
  estateId,
  assetId,
  filters,
}: {
  estateId: string;
  assetId: string;
  filters: HistoryDateFilters;
}) {
  const access = useAssetHistoryAccess(estateId);
  const history = useAssetHistory(estateId, assetId, filters);
  const [selected, setSelected] = useState<{
    document: HistoryDocument;
    trigger: HTMLButtonElement;
  }>();
  const openDocument = useCallback(
    (document: HistoryDocument, trigger: HTMLButtonElement) =>
      setSelected({ document, trigger }),
    []
  );
  const closeDocument = useCallback(() => setSelected(undefined), []);
  const more = useCallback(() => {
    history.fetchNextPage();
  }, [history.fetchNextPage]);
  const retry = useCallback(() => {
    if (history.isFetchNextPageError) {
      history.fetchNextPage();
    } else {
      history.refetch();
    }
  }, [history.isFetchNextPageError, history.fetchNextPage, history.refetch]);
  const pages = history.data?.pages;
  const documentsVisible =
    access.canViewDocuments && pages?.[0]?.documentsVisible !== false;
  useEffect(() => {
    if (!documentsVisible) {
      setSelected(undefined);
    }
  }, [documentsVisible]);
  const entries = [
    ...new Map(
      pages?.flatMap((page) => page.items).map((entry) => [entry.id, entry]) ??
        []
    ).values(),
  ].filter((entry) => entry.details.kind !== "DOCUMENT" || documentsVisible);
  if (history.denied) {
    return <p role="alert">You do not have access to this asset’s history.</p>;
  }
  const visibleDocument =
    selected &&
    entries.some(
      (entry) =>
        entry.sourceId === selected.document.id &&
        entry.details.kind === "DOCUMENT"
    );
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-semibold">History</h2>
      <p className="text-muted-foreground text-sm">
        History contains recorded activity only. Older activity may not have
        been recorded.
      </p>
      {history.isPending ? (
        <LoadingState label="Loading asset history…" rows={3} />
      ) : null}
      {documentsVisible ? null : (
        <p role="note">
          Document entries are hidden because you do not have document access.
        </p>
      )}
      {pages && entries.length === 0 ? (
        <EmptyState
          icon={History}
          title={
            filters.from || filters.to
              ? "No recorded history in this date range"
              : "No recorded history"
          }
        />
      ) : null}
      {entries.length ? (
        <ol aria-label="Recorded asset history" className="divide-y">
          {entries.map((entry) => (
            <HistoryTimelineEntry
              assetId={assetId}
              canViewDocuments={access.canViewDocuments}
              canViewInspections={!!access.permission?.canViewInspectionResults}
              canViewWorkOrders={!!access.permission?.canViewWorkOrders}
              entry={entry}
              estateId={estateId}
              key={entry.id}
              onOpen={openDocument}
            />
          ))}
        </ol>
      ) : null}
      {history.error ? (
        <ErrorState message={history.error.message} onRetry={retry} />
      ) : null}
      {history.hasNextPage && !history.isFetchNextPageError ? (
        <Button
          disabled={history.isFetchingNextPage}
          onClick={more}
          variant="outline"
        >
          {history.isFetchingNextPage ? "Loading more…" : "Load more"}
        </Button>
      ) : null}
      {selected && visibleDocument && access.canViewDocuments ? (
        <HistoryDocumentDialog
          assetId={assetId}
          document={selected.document}
          estateId={estateId}
          key={selected.document.id}
          onClose={closeDocument}
          trigger={selected.trigger}
        />
      ) : null}
    </section>
  );
}
