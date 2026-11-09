import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { useMemo } from "react";
import { useFilterPanel } from "@/components/filters/filter-bar";
import { PageLayout } from "@/components/page/page-layout";
import { useAppAccess } from "@/lib/access";
import { useAsset } from "@/lib/assets";
import { type ReadingSearch, readingFilterError } from "@/lib/reading-filters";
import { useAssetReadingGroupPages } from "@/lib/readings";
import { AssetReadingGroups } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/asset-reading-groups";
import { AssetReadingsHeader } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/asset-readings-header";
import { ReadingExport } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-export";
import {
  countReadingFilters,
  ReadingFilterControls,
} from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-filter-controls";
import { ReadingToolbar } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-toolbar";

const countFormat = new Intl.NumberFormat();

/**
 * One asset's readings grouped per timestamp (the overview's table), filtered
 * by the URL. The CSV export stays per reading, through the estate export with
 * the asset fixed. `filters` never carries the asset.
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
  const readings = useAssetReadingGroupPages(estateId, assetId, filters);
  const error = readingFilterError(scoped);
  const activeCount = countReadingFilters(filters);
  const panel = useFilterPanel(activeCount);
  const shown = readings.data?.pages.reduce(
    (total, page) => total + page.groups.length,
    0
  );
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
        estateId={estateId}
      />
      <div className="space-y-3">
        <ReadingToolbar
          activeCount={activeCount}
          exportAction={
            <ReadingExport
              disabled={!!error || readings.isPending || readings.isError}
              estateId={estateId}
              filters={scoped}
            />
          }
          summary={
            shown ? (
              <>
                Showing {countFormat.format(shown)}{" "}
                {shown === 1 ? "time" : "times"}
              </>
            ) : null
          }
          {...panel.toggleProps}
        />
        <ReadingFilterControls
          error={error}
          filters={filters}
          onFiltersChange={onFiltersChange}
          {...panel.barProps}
        />
      </div>
      <AssetReadingGroups
        filters={filters}
        onFiltersChange={onFiltersChange}
        readings={readings}
        validationError={error}
      />
    </PageLayout>
  );
}
