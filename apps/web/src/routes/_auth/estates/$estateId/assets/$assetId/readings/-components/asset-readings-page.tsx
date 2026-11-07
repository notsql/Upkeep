import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { useMemo } from "react";
import { PageLayout } from "@/components/page/page-layout";
import { useAppAccess } from "@/lib/access";
import { useAsset } from "@/lib/assets";
import { type ReadingSearch, readingFilterError } from "@/lib/reading-filters";
import { useEstateReadings } from "@/lib/readings";
import { AssetReadingsHeader } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/asset-readings-header";
import { ReadingExport } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-export";
import { ReadingFilterControls } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-filter-controls";
import { ReadingResults } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-results";

/**
 * One asset's readings, built on the estate readings endpoint with the asset
 * fixed (it serves Owner, Manager and Crew; the legacy asset endpoint is
 * owner-only). `filters` never carries the asset.
 */
export function AssetReadingsPage({
  estateId,
  assetId,
  filters,
  onFiltersChange,
}: {
  estateId: string;
  assetId: string;
  filters: ReadingSearch;
  onFiltersChange: (filters: ReadingSearch) => void;
}) {
  const access = useAppAccess();
  const estate = access.data?.estates.find(
    (item) => item.estateId === estateId
  );
  const asset = useAsset(estateId, assetId);
  const scoped = useMemo(() => ({ ...filters, assetId }), [filters, assetId]);
  const readings = useEstateReadings(estateId, scoped);
  const error = readingFilterError(scoped);
  if (access.data && !estate?.canViewReadings) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Readings access is no longer available.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <PageLayout className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <AssetReadingsHeader
        assetId={assetId}
        assetName={asset.data?.name}
        canRecord={estate?.canRecordReadings}
        estateId={estateId}
        metric={filters.metric}
      />
      <ReadingExport
        disabled={
          !!error ||
          readings.isFetching ||
          readings.isPending ||
          readings.isError
        }
        estateId={estateId}
        filters={scoped}
      />
      <ReadingFilterControls
        error={error}
        filters={filters}
        onFiltersChange={onFiltersChange}
      />
      <ReadingResults
        assetsPending={false}
        filters={filters}
        onFiltersChange={onFiltersChange}
        readings={readings}
        validationError={error}
      />
    </PageLayout>
  );
}
