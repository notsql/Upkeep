import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { Empty, EmptyHeader, EmptyTitle } from "@proj/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { useAsset } from "@/lib/assets";
import { deviceMetrics } from "@/lib/devices";
import { useEstate } from "@/lib/estates";
import {
  type AssetReading,
  flagLabel,
  READINGS_PAGE_SIZE,
  type ReadingFilters,
  useReadings,
} from "@/lib/readings";
import { ReadingFilterControls } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/reading-filters";

function emptyMessage(filters: ReadingFilters): string {
  if (filters.suspect) {
    return "No suspect readings match";
  }
  if (filters.metric || filters.from || filters.to) {
    return "No readings match these filters";
  }
  return "No readings yet";
}

function ReadingRow({ reading }: { reading: AssetReading }) {
  return (
    <TableRow>
      <TableCell>{new Date(reading.measuredAt).toLocaleString()}</TableCell>
      <TableCell>{deviceMetrics[reading.metric].name}</TableCell>
      <TableCell>{`${reading.value} ${reading.unit}`}</TableCell>
      <TableCell className="break-all">{reading.deviceIdentifier}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {reading.flags.map((flag) => (
            <Badge key={flag.type} variant="outline">
              {flagLabel(flag, reading.unit)}
            </Badge>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
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
  const estate = useEstate(estateId);
  const asset = useAsset(estateId, assetId);
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
  return (
    <main className="page-layout space-y-6">
      <Link
        className="text-sm underline"
        params={{ estateId, assetId }}
        to="/estates/$estateId/assets/$assetId"
      >
        Back to asset
      </Link>
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: estate.data?.name ?? "Estate",
            to: "/estates/$estateId",
            params: { estateId },
          },
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
        description="Sensor readings for this asset, newest first. Suspect readings are flagged."
        title="Readings"
      />
      <ReadingFilterControls filters={filters} onChange={onFiltersChange} />
      {readings.isPending ? <p role="status">Loading readings…</p> : null}
      {readings.error ? (
        <Alert variant="destructive">
          <AlertDescription>{readings.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {readings.data && total === 0 ? (
        <Empty className="border border-dashed" role="status">
          <EmptyHeader>
            <EmptyTitle>{emptyMessage(filters)}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : null}
      {readings.data && total > 0 ? (
        <>
          <Table aria-label="Readings">
            <TableHeader>
              <TableRow>
                {["Measured", "Metric", "Value", "Device", "Flags"].map(
                  (label) => (
                    <TableHead key={label}>{label}</TableHead>
                  )
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {readings.data.items.map((reading) => (
                <ReadingRow key={reading.id} reading={reading} />
              ))}
            </TableBody>
          </Table>
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
    </main>
  );
}
