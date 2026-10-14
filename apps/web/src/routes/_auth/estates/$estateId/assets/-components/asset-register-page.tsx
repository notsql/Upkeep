import {
  Alert,
  AlertAction,
  AlertDescription,
} from "@proj/ui/components/alert";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import { Empty } from "@proj/ui/components/empty";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConditionBadge } from "@/components/condition-badge";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";
import { PageHeader } from "@/components/page-header";
import { type AssetFilters, useAssets } from "@/lib/assets";
import { categoryLabel, useAssetCategories } from "@/lib/catalogue";
import { useEstate } from "@/lib/estates";
import { flattenLocations, useLocations } from "@/lib/locations";
import { useMobile } from "@/lib/use-mobile";
import {
  AssetFilterControls,
  MobileAssetFilters,
} from "@/routes/_auth/estates/$estateId/assets/-components/asset-filters";

export function AssetRegisterPage({
  estateId,
  filters,
  onFiltersChange,
}: {
  estateId: string;
  filters: AssetFilters;
  onFiltersChange: (filters: AssetFilters) => void;
}) {
  const mobile = useMobile();
  const assets = useAssets(estateId, filters);
  const categories = useAssetCategories();
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
  const filtered = Boolean(
    filters.q ||
      filters.category ||
      filters.locationId ||
      filters.condition ||
      (filters.status && filters.status !== "ACTIVE")
  );
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
    <main className="page-layout space-y-6">
      <Link className="underline" params={{ estateId }} to="/estates/$estateId">
        Back to estate
      </Link>
      <PageHeader
        actions={
          estate.data?.deactivatedAt ? undefined : (
            <Link
              className={buttonVariants()}
              params={{ estateId }}
              to="/estates/$estateId/assets/new"
            >
              Register asset
            </Link>
          )
        }
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: estate.data?.name ?? "Estate",
            to: "/estates/$estateId",
            params: { estateId },
          },
          { label: "Assets" },
        ]}
        description="Find equipment by location, category and latest condition."
        title="Assets"
      />
      {estate.data?.deactivatedAt ? (
        <Alert role="note">
          <AlertDescription>
            This estate is inactive. Existing assets remain available.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="section-surface grid grid-cols-[minmax(0,1fr)_auto] gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Field>
          <FieldLabel htmlFor="asset-search">Search assets</FieldLabel>
          <Input
            id="asset-search"
            onChange={changeSearch}
            placeholder="Name or reference"
            value={search}
          />
        </Field>
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
      </div>
      {filtered ? (
        <Button onClick={clearFilters} variant="outline">
          Clear filters
        </Button>
      ) : null}
      {locations.error ? (
        <Alert variant="destructive">
          <AlertDescription>Locations could not be loaded.</AlertDescription>
          <AlertAction>
            <Button onClick={retryLocations} size="sm">
              Retry locations
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      {assets.isPending ? <p role="status">Loading assets…</p> : null}
      {assets.error ? (
        <Alert variant="destructive">
          <AlertDescription>{assets.error.message}</AlertDescription>
          <AlertAction>
            <Button onClick={retryAssets} size="sm">
              Retry assets
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      {assets.data?.length === 0 ? (
        <Empty className="border border-dashed" role="status">
          {filtered
            ? "No matching assets."
            : "No active assets yet. Choose All to include retired assets."}
        </Empty>
      ) : null}
      {assets.data && assets.data.length > 0 && mobile ? (
        <ul aria-label="Assets" className="grid gap-3">
          {assets.data.map((asset) => (
            <li key={asset.id}>
              <Link
                aria-label={`${asset.name} (${asset.reference})`}
                className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                params={{ estateId, assetId: asset.id }}
                to="/estates/$estateId/assets/$assetId"
              >
                <Card className="h-full transition-[background-color,box-shadow] group-hover:bg-accent/40 group-hover:shadow-sm group-hover:ring-primary/40 group-focus-visible:bg-accent/40 group-focus-visible:ring-primary/40 group-active:bg-accent group-active:ring-primary/40 motion-reduce:transition-none">
                  <CardContent className="grid gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="break-words font-semibold underline">
                          {asset.name}
                        </h2>
                        <p className="mt-1 text-muted-foreground text-sm">
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
                        <dt className="mb-1 text-muted-foreground">
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
              {[
                "Reference",
                "Name",
                "Category",
                "Location",
                "Current condition",
                "Status",
              ].map((label) => (
                <TableHead key={label}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.data.map((asset) => (
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
    </main>
  );
}
