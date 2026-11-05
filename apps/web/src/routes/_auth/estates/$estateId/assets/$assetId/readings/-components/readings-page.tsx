import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Activity } from "lucide-react";
import { useCallback } from "react";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { CreateButton } from "@/components/page-actions";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { ReadingCards } from "@/components/readings/reading-cards";
import { useAppAccess } from "@/lib/access";
import { useAsset } from "@/lib/assets";
import {
  READINGS_PAGE_SIZE,
  type ReadingFilters,
  useReadings,
} from "@/lib/readings";
import { useMobile } from "@/lib/use-mobile";
import { ReadingFilterControls } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/reading-filters";
import { ReadingRow } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/reading-row";

function emptyMessage(filters: ReadingFilters): string {
  if (filters.suspect) {
    return "No suspect readings match";
  }
  if (filters.metric || filters.from || filters.to) {
    return "No readings match these filters";
  }
  return "No readings yet";
}

export function ReadingsPage({
  estateId,
  assetId,
  filters,
  onFiltersChange,
}: {
  estateId: string;
  assetId: string;
  filters: ReadingFilters;
  onFiltersChange: (filters: ReadingFilters) => void;
}) {
  const mobile = useMobile();
  const asset = useAsset(estateId, assetId);
  const canRecord = useAppAccess().data?.estates.find(
    (entry) => entry.estateId === estateId
  )?.canRecordReadings;
  const readings = useReadings(estateId, assetId, filters);
  const page = filters.page ?? 0;
  const total = readings.data?.totalItems ?? 0;
  const pages = Math.max(1, Math.ceil(total / READINGS_PAGE_SIZE));
  const previous = useCallback(
    () => onFiltersChange({ ...filters, page: page - 1 }),
    [filters, onFiltersChange, page]
  );
  const next = useCallback(
    () => onFiltersChange({ ...filters, page: page + 1 }),
    [filters, onFiltersChange, page]
  );
  const filtered = Boolean(
    filters.suspect || filters.metric || filters.from || filters.to
  );
  const clearFilters = useCallback(
    () => onFiltersChange({}),
    [onFiltersChange]
  );
  return (
    <PageLayout className="space-y-6">
      <PageHeader
        actions={
          canRecord ? (
            <CreateButton
              params={{ estateId }}
              search={{ assetId, metric: filters.metric }}
              to="/estates/$estateId/readings/new"
            />
          ) : undefined
        }
        breadcrumbs={[
          {
            label: "Assets",
            to: "/estates/$estateId/assets",
            params: { estateId },
          },
          {
            label: asset.data?.name ?? "Asset",
            to: "/estates/$estateId/assets/$assetId",
            params: { estateId, assetId },
          },
          { label: "Readings" },
        ]}
        description="Sensor readings, newest first"
        icon={Activity}
        title="Readings"
      />
      <ReadingFilterControls filters={filters} onChange={onFiltersChange} />
      {readings.isPending ? (
        <LoadingState label="Loading readings…" rows={2} />
      ) : null}
      {readings.error ? (
        <Alert variant="destructive">
          <AlertDescription>{readings.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {readings.data && total === 0 ? (
        <EmptyState
          action={
            filtered ? (
              <Button onClick={clearFilters} variant="outline">
                Clear filters
              </Button>
            ) : undefined
          }
          title={emptyMessage(filters)}
        />
      ) : null}
      {readings.data && total > 0 ? (
        <>
          {mobile ? (
            <ReadingCards
              items={readings.data.items}
              refreshing={readings.isFetching}
            />
          ) : (
            <Table aria-label="Readings">
              <TableHeader>
                <TableRow>
                  {[
                    "Measured",
                    "Metric",
                    "Value",
                    "Source",
                    "Device",
                    "Flags",
                  ].map((label) => (
                    <TableHead key={label}>{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {readings.data.items.map((reading) => (
                  <ReadingRow key={reading.id} reading={reading} />
                ))}
              </TableBody>
            </Table>
          )}
          <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-muted-foreground text-sm">
              {`Page ${page + 1} of ${pages} · ${total} ${total === 1 ? "reading" : "readings"}`}
            </p>
            <div className="flex gap-2">
              <Button disabled={page <= 0} onClick={previous} variant="outline">
                Previous page
              </Button>
              <Button
                disabled={page >= pages - 1}
                onClick={next}
                variant="outline"
              >
                Next page
              </Button>
            </div>
          </nav>
        </>
      ) : null}
    </PageLayout>
  );
}
