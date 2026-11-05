import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { ListChecks } from "lucide-react";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { Pagination } from "@/components/pagination";
import { SectionCard } from "@/components/section-card";
import { useInspectionAsset, useInspectionResults } from "@/lib/inspections";
import { useWorkOrderAccess } from "@/lib/work-orders";
import { InspectionHistoryRow } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-row";

export function InspectionHistoryPage({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const history = useInspectionResults(estateId, assetId, cursors.at(-1));
  const asset = useInspectionAsset(estateId, assetId);
  const workAccess = useWorkOrderAccess(estateId);
  const active = !!(
    asset.data?.estateActive &&
    asset.data.assetActive &&
    asset.data.locationActive
  );
  const nextCursor = history.data?.nextCursor;
  const next = useCallback(() => {
    if (nextCursor && !history.isFetching) {
      setCursors((current) => [...current, nextCursor]);
    }
  }, [nextCursor, history.isFetching]);
  const previous = useCallback(() => {
    setCursors((current) =>
      current.length > 1 ? current.slice(0, -1) : current
    );
  }, []);
  const retry = useCallback(() => history.refetch(), [history.refetch]);

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
          <Table aria-label="Inspection records">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Inspection date</TableHead>
                <TableHead scope="col">Outcome</TableHead>
                <TableHead scope="col">Follow-up / work order</TableHead>
                <TableHead scope="col">Inspector</TableHead>
                <TableHead scope="col">View record</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.data.items.map((record) => (
                <InspectionHistoryRow
                  canCreateWorkOrder={workAccess.canCreate && active}
                  canViewWorkOrder={workAccess.canView}
                  key={record.id}
                  record={record}
                />
              ))}
            </TableBody>
          </Table>
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
