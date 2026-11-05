import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { Layers, SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConditionBadge } from "@/components/condition-badge";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { FilterBar, useFilterPanel } from "@/components/filter-bar";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";
import { LoadingState } from "@/components/loading-state";
import { CreateButton } from "@/components/page-actions";
import { ListPageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { SortableTableHead } from "@/components/sortable-table-head";
import {
  type AssetSort,
  type AssetSortColumn,
  assetSortOptions,
  sortAssets,
} from "@/lib/asset-sorting";
import { type AssetFilters, useAssets } from "@/lib/assets";
import { categoryLabel, useAssetCategories } from "@/lib/catalogue";
import { useEstate } from "@/lib/estates";
import { flattenLocations, useLocations } from "@/lib/locations";
import { useMobile } from "@/lib/use-mobile";
import {
  AssetFilterControls,
  MobileAssetFilters,
} from "@/routes/_auth/estates/$estateId/assets/-components/asset-filters";
import { AssetSortControls } from "./asset-sort-controls";

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
  const mobile = useMobile();
  const assets = useAssets(estateId, filters);
  const categories = useAssetCategories();
  const sortedAssets = useMemo(
    () => sortAssets(assets.data ?? [], sort, categories.data),
    [assets.data, sort, categories.data]
  );
  const sortColumn = sort.sortBy ?? "REFERENCE";
  const descending = sort.direction === "DESC";
  const changeSort = useCallback(
    (column: AssetSortColumn) => {
      let direction: NonNullable<AssetSort["direction"]> =
        column === "CONDITION" ? "DESC" : "ASC";
      if (column === sortColumn) {
        direction = descending ? "ASC" : "DESC";
      }
      onSortChange?.({ sortBy: column, direction });
    },
    [onSortChange, sortColumn, descending]
  );
  const estate = useEstate(estateId);
  const locations = useLocations(estateId, true);
  const [search, setSearch] = useState(filters.q ?? "");
  useEffect(() => setSearch(filters.q ?? ""), [filters.q]);
  useEffect(() => {
    if (search.trim() === (filters.q ?? "")) {
      return;
    }
    const timer = setTimeout(
      () => onFiltersChange({ ...filters, q: search.trim() || undefined }),
      300
    );
    return () => clearTimeout(timer);
  }, [search, filters, onFiltersChange]);
  const activeCount = [
    filters.q,
    filters.category,
    filters.locationId,
    filters.condition,
    filters.status && filters.status !== "ACTIVE",
  ].filter(Boolean).length;
  const filtered = activeCount > 0;
  const panel = useFilterPanel(activeCount);
  const canRegister = !estate.data?.deactivatedAt;
  const locationOptions = useMemo(
    () =>
      Object.fromEntries(
        flattenLocations(locations.data ?? []).map((location) => [
          location.id,
          `${location.path.join(" › ")}${location.deactivatedAt ? " (inactive)" : ""}`,
        ])
      ),
    [locations.data]
  );
  const retryAssets = useCallback(() => assets.refetch(), [assets.refetch]);
  const retryLocations = useCallback(
    () => locations.refetch(),
    [locations.refetch]
  );
  const clearFilters = useCallback(() => {
    setSearch("");
    onFiltersChange({});
  }, [onFiltersChange]);
  const changeSearch = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setSearch(event.target.value),
    []
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
      <FilterBar
        activeCount={activeCount}
        label="Filter assets"
        onClear={clearFilters}
        {...panel.barProps}
        search={
          <Field>
            <FieldLabel htmlFor="asset-search">Search assets</FieldLabel>
            <Input
              id="asset-search"
              onChange={changeSearch}
              placeholder="Name or reference"
              value={search}
            />
          </Field>
        }
      >
        {mobile ? (
          <MobileAssetFilters
            filters={filters}
            locations={locationOptions}
            onChange={onFiltersChange}
          />
        ) : (
          <AssetFilterControls
            filters={filters}
            locations={locationOptions}
            onChange={onFiltersChange}
          />
        )}
      </FilterBar>
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
          estateId={estateId}
          filtered={filtered}
          onClear={clearFilters}
        />
      ) : null}
      {assets.data && assets.data.length > 0 && mobile ? (
        <ul aria-label="Assets" className="grid gap-3">
          {sortedAssets.map((asset) => (
            <li key={asset.id}>
              <Link
                aria-label={`${asset.name} (${asset.reference})`}
                className="group focus-visible:ring-ring block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                params={{ estateId, assetId: asset.id }}
                to="/estates/$estateId/assets/$assetId"
              >
                <Card className="group-hover:bg-accent/40 group-hover:ring-primary/40 group-focus-visible:bg-accent/40 group-focus-visible:ring-primary/40 group-active:bg-accent group-active:ring-primary/40 h-full transition-[background-color,box-shadow] group-hover:shadow-sm motion-reduce:transition-none">
                  <CardContent className="grid gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-semibold break-words underline">
                          {asset.name}
                        </h2>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {asset.reference}
                        </p>
                      </div>
                      <LifecycleStatusBadge
                        inactive={Boolean(asset.deactivatedAt)}
                        inactiveLabel="Retired"
                      />
                    </div>
                    <dl className="grid gap-2 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Category</dt>
                        <dd>
                          {categoryLabel(categories.data, asset.category)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Location</dt>
                        <dd className="break-words">{asset.locationPath}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground mb-1">
                          Current condition
                        </dt>
                        <dd>
                          <ConditionBadge condition={asset.currentCondition} />
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {assets.data && assets.data.length > 0 && !mobile ? (
        <Table aria-label="Assets">
          <TableHeader>
            <TableRow>
              {assetSortOptions.map((option) => (
                <SortableTableHead
                  active={sortColumn === option.value}
                  column={option.value}
                  descending={descending}
                  key={option.value}
                  label={option.label}
                  onSort={changeSort}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAssets.map((asset) => (
              <TableRow key={asset.id}>
                <TableCell>
                  <Link
                    className="underline"
                    params={{ estateId, assetId: asset.id }}
                    to="/estates/$estateId/assets/$assetId"
                  >
                    {asset.reference}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    className="underline"
                    params={{ estateId, assetId: asset.id }}
                    to="/estates/$estateId/assets/$assetId"
                  >
                    {asset.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {categoryLabel(categories.data, asset.category)}
                </TableCell>
                <TableCell>{asset.locationPath}</TableCell>
                <TableCell>
                  <ConditionBadge condition={asset.currentCondition} />
                </TableCell>
                <TableCell>
                  <LifecycleStatusBadge
                    inactive={Boolean(asset.deactivatedAt)}
                    inactiveLabel="Retired"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </PageLayout>
  );
}

function AssetsEmpty({
  estateId,
  filtered,
  canRegister,
  onClear,
}: {
  estateId: string;
  filtered: boolean;
  canRegister: boolean;
  onClear: () => void;
}) {
  if (filtered) {
    return (
      <EmptyState
        action={
          <Button onClick={onClear} variant="outline">
            Clear filters
          </Button>
        }
        description="Try fewer filters"
        icon={SearchX}
        title="No matching assets"
      />
    );
  }
  return (
    <EmptyState
      action={
        canRegister ? (
          <CreateButton
            params={{ estateId }}
            to="/estates/$estateId/assets/new"
          />
        ) : undefined
      }
      description="Set Status to All to include retired assets"
      title="No assets yet"
    />
  );
}
