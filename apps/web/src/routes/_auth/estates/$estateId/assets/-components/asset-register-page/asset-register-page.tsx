import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Layers } from "lucide-react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import type { AssetSort } from "@/lib/asset-sorting";
import type { AssetFilters } from "@/lib/assets";
import { AssetRegisterFilters } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page/asset-register-filters";
import { AssetRegisterList } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page/asset-register-list";
import { AssetRegisterTable } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page/asset-register-table";
import { AssetSortControls } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page/asset-sort-controls";
import { AssetsEmpty } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page/assets-empty";
import { useAssetRegisterPage } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page/use-asset-register-page";
import { AssetViewsNav } from "@/routes/_auth/estates/$estateId/assets/-components/asset-views-nav";

export function AssetRegisterPage({
  estateId,
  filters,
  onFiltersChange,
  sort = {},
  onSortChange,
}: {
  estateId: string;
  filters: AssetFilters;
  onFiltersChange: (filters: AssetFilters) => void;
  sort?: AssetSort;
  onSortChange?: (sort: AssetSort) => void;
}) {
  const {
    activeCount,
    assets,
    canRegister,
    categories,
    changeSearch,
    changeSort,
    clearFilters,
    descending,
    estate,
    failedSources,
    filtered,
    groups,
    locations,
    locationOptions,
    mobile,
    monitoring,
    panel,
    retryAssets,
    retryLocations,
    retryMonitoring,
    search,
    sortColumn,
    sortedAssets,
  } = useAssetRegisterPage(
    estateId,
    filters,
    onFiltersChange,
    sort,
    onSortChange
  );
  return (
    <PageLayout className="space-y-6">
      <ListPageHeader
        create={
          canRegister
            ? { params: { estateId }, to: "/estates/$estateId/assets/new" }
            : undefined
        }
        description="Equipment in this estate"
        filters={{ activeCount, ...panel.toggleProps }}
        icon={Layers}
        title="Assets"
      />
      <AssetViewsNav estateId={estateId} />
      {estate.data?.deactivatedAt ? (
        <Alert role="note">
          <AlertDescription>
            This estate is inactive. Existing assets remain available.
          </AlertDescription>
        </Alert>
      ) : null}
      <AssetRegisterFilters
        activeCount={activeCount}
        barProps={panel.barProps}
        filters={filters}
        locationOptions={locationOptions}
        mobile={mobile}
        onChangeSearch={changeSearch}
        onClear={clearFilters}
        onFiltersChange={onFiltersChange}
        search={search}
      />
      {mobile ? (
        <AssetSortControls onChange={onSortChange} sort={sort} />
      ) : null}
      {locations.error ? (
        <ErrorState
          message="Locations could not be loaded."
          onRetry={retryLocations}
          retryLabel="Retry locations"
        />
      ) : null}
      {failedSources.length > 0 && assets.data ? (
        <ErrorState
          message={monitoringFailure(failedSources)}
          onRetry={retryMonitoring}
        />
      ) : null}
      {assets.isPending || (assets.data && locations.isPending) ? (
        <LoadingState
          label="Loading assets…"
          variant={mobile ? "list" : "table"}
        />
      ) : null}
      {assets.error ? (
        <ErrorState
          message={assets.error.message}
          onRetry={retryAssets}
          retryLabel="Retry assets"
        />
      ) : null}
      {assets.data?.length === 0 ? (
        <AssetsEmpty
          canRegister={canRegister}
          filtered={filtered}
          onClear={clearFilters}
        />
      ) : null}
      {assets.data &&
      assets.data.length > 0 &&
      !locations.isPending &&
      mobile ? (
        <AssetRegisterList
          assets={sortedAssets}
          categories={categories}
          estateId={estateId}
          groups={groups}
          monitoring={monitoring}
        />
      ) : null}
      {assets.data &&
      assets.data.length > 0 &&
      !locations.isPending &&
      !mobile ? (
        <AssetRegisterTable
          assets={sortedAssets}
          categories={categories}
          descending={descending}
          estateId={estateId}
          groups={groups}
          monitoring={monitoring}
          onSort={changeSort}
          sortColumn={sortColumn}
        />
      ) : null}
    </PageLayout>
  );
}

/** One message naming every secondary source that failed. */
function monitoringFailure(sources: ("devices" | "risk")[]): string {
  if (sources.length === 2) {
    return "Couldn't load sensor status or the chance of breaking down. Try again.";
  }
  return sources[0] === "devices"
    ? "Device status could not be loaded."
    : "Couldn't load the chance of breaking down. Try again.";
}
