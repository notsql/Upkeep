import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Layers } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { ListPageHeader } from "@/components/list-page-header";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
import type { AssetSort } from "@/lib/asset-sorting";
import type { AssetFilters } from "@/lib/assets";
import { AssetRegisterCards } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-cards";
import { AssetRegisterFilters } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-filters";
import { AssetRegisterTable } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-table";
import { AssetSortControls } from "@/routes/_auth/estates/$estateId/assets/-components/asset-sort-controls";
import { AssetsEmpty } from "@/routes/_auth/estates/$estateId/assets/-components/assets-empty";
import { useAssetRegisterPage } from "@/routes/_auth/estates/$estateId/assets/-components/use-asset-register-page";

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
    filtered,
    locations,
    locationOptions,
    mobile,
    panel,
    retryAssets,
    retryLocations,
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
      {assets.isPending ? (
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
      {assets.data && assets.data.length > 0 && mobile ? (
        <AssetRegisterCards
          assets={sortedAssets}
          categories={categories}
          estateId={estateId}
        />
      ) : null}
      {assets.data && assets.data.length > 0 && !mobile ? (
        <AssetRegisterTable
          assets={sortedAssets}
          categories={categories}
          descending={descending}
          estateId={estateId}
          onSort={changeSort}
          sortColumn={sortColumn}
        />
      ) : null}
    </PageLayout>
  );
}
