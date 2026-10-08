import { Badge } from "@proj/ui/components/badge";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";
import { PageHeader } from "@/components/page-header";
import { conditionLabel } from "@/lib/assessments";
import { type AssetFilters, assetCategoryLabel, useAssets } from "@/lib/assets";
import { useEstate } from "@/lib/estates";
import { flattenLocations, useLocations } from "@/lib/locations";

const conditions = {
  ...conditionLabel,
  UNASSESSED: "Not assessed yet",
};
function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}) {
  const handleValueChange = useCallback(
    (next: string | null) => onChange(next ?? ""),
    [onChange]
  );
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select onValueChange={handleValueChange} value={value}>
        <SelectTrigger aria-label={label}>
          <SelectValue>{options[value] ?? "All"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function AssetRegisterPage({
  estateId,
  filters,
  onFiltersChange,
}: {
  estateId: string;
  filters: AssetFilters;
  onFiltersChange: (filters: AssetFilters) => void;
}) {
  const assets = useAssets(estateId, filters);
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
  const locationOptions = Object.fromEntries(
    flattenLocations(locations.data ?? []).map((location) => [
      location.id,
      `${location.path.join(" › ")}${location.deactivatedAt ? " (inactive)" : ""}`,
    ])
  );
  const retryAssets = useCallback(() => assets.refetch(), [assets]);
  const retryLocations = useCallback(() => locations.refetch(), [locations]);
  const clearFilters = useCallback(() => {
    setSearch("");
    onFiltersChange({});
  }, [onFiltersChange]);
  const changeStatus = useCallback(
    (value: string) =>
      onFiltersChange({
        ...filters,
        status: value as AssetFilters["status"],
      }),
    [onFiltersChange, filters]
  );
  const changeCondition = useCallback(
    (value: string) =>
      onFiltersChange({
        ...filters,
        condition: (value as AssetFilters["condition"]) || undefined,
      }),
    [onFiltersChange, filters]
  );
  const changeLocation = useCallback(
    (value: string) =>
      onFiltersChange({ ...filters, locationId: value || undefined }),
    [onFiltersChange, filters]
  );
  const changeCategory = useCallback(
    (value: string) =>
      onFiltersChange({
        ...filters,
        category: (value as AssetFilters["category"]) || undefined,
      }),
    [onFiltersChange, filters]
  );
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
        <p className="section-surface text-muted-foreground text-sm">
          This estate is inactive. Existing assets remain available.
        </p>
      ) : null}
      <div className="section-surface grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="asset-search">Search assets</Label>
          <Input
            id="asset-search"
            onChange={changeSearch}
            placeholder="Name or reference"
            value={search}
          />
        </div>
        <FilterSelect
          label="Category"
          onChange={changeCategory}
          options={{ "": "All categories", ...assetCategoryLabel }}
          value={filters.category ?? ""}
        />
        <FilterSelect
          label="Location"
          onChange={changeLocation}
          options={{ "": "All locations", ...locationOptions }}
          value={filters.locationId ?? ""}
        />
        <FilterSelect
          label="Condition"
          onChange={changeCondition}
          options={{ "": "All conditions", ...conditions }}
          value={filters.condition ?? ""}
        />
        <FilterSelect
          label="Status"
          onChange={changeStatus}
          options={{ ACTIVE: "Active", INACTIVE: "Retired", ALL: "All" }}
          value={filters.status ?? "ACTIVE"}
        />
      </div>
      {filtered ? (
        <Button onClick={clearFilters} variant="outline">
          Clear filters
        </Button>
      ) : null}
      {locations.error ? (
        <div role="alert">
          Locations could not be loaded.{" "}
          <Button onClick={retryLocations}>Retry locations</Button>
        </div>
      ) : null}
      {assets.isPending ? <p role="status">Loading assets…</p> : null}
      {assets.error ? (
        <div role="alert">
          {assets.error.message}
          <Button onClick={retryAssets}>Retry assets</Button>
        </div>
      ) : null}
      {assets.data?.length === 0 ? (
        <p>
          {filtered
            ? "No matching assets."
            : "No active assets yet. Choose All to include retired assets."}
        </p>
      ) : null}
      {assets.data && assets.data.length > 0 ? (
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
                <TableCell>{assetCategoryLabel[asset.category]}</TableCell>
                <TableCell>{asset.locationPath}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {conditions[asset.currentCondition ?? "UNASSESSED"]}
                  </Badge>
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
