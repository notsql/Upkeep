import { Button } from "@proj/ui/components/button";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { type Asset, type AssetFilters, useAssets } from "@/lib/assets";
import { categoryLabel, useAssetCategories } from "@/lib/catalogue";
import { flattenLocations, useLocations } from "@/lib/locations";
import { AssetFilterControls } from "@/routes/_auth/estates/$estateId/assets/-components/asset-filters/asset-filters";

import { AssetChoice } from "@/routes/_auth/estates/$estateId/documents/-components/document-asset-dialog/asset-choice";

export function DocumentAssetPicker({
  estateId,
  selected,
  disabled,
  onSelect,
}: {
  estateId: string;
  selected?: Asset;
  disabled: boolean;
  onSelect: (asset?: Asset) => void;
}) {
  const [filters, setFilters] = useState<AssetFilters>({ status: "ALL" });
  const [search, setSearch] = useState("");
  const assets = useAssets(estateId, filters);
  const categories = useAssetCategories();
  const locations = useLocations(estateId, true);
  const changeSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
    []
  );
  const applySearch = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFilters((previous) => ({
        ...previous,
        q: search.trim() || undefined,
      }));
    },
    [search]
  );
  const clear = useCallback(() => {
    setSearch("");
    setFilters({ status: "ALL" });
  }, []);
  const retry = useCallback(() => assets.refetch(), [assets.refetch]);
  const locationOptions = Object.fromEntries(
    flattenLocations(locations.data ?? []).map((location) => [
      location.id,
      location.path.join(" › "),
    ])
  );
  const filtered = !!(
    filters.q ||
    filters.category ||
    filters.locationId ||
    filters.condition ||
    filters.status !== "ALL"
  );
  return (
    <section aria-label="Choose an asset" className="min-w-0 space-y-4">
      <form className="flex flex-wrap items-end gap-2" onSubmit={applySearch}>
        <Field className="min-w-0 flex-1">
          <FieldLabel htmlFor="document-asset-search">Search assets</FieldLabel>
          <Input
            id="document-asset-search"
            onChange={changeSearch}
            type="search"
            value={search}
          />
        </Field>
        <Button type="submit" variant="outline">
          Search
        </Button>
        <Button onClick={clear} type="button" variant="ghost">
          Clear filters
        </Button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">
        <AssetFilterControls
          filters={filters}
          locations={locationOptions}
          onChange={setFilters}
        />
      </div>
      {selected ? (
        <p aria-live="polite">
          Selected: {selected.reference} — {selected.name}
        </p>
      ) : null}
      {assets.isPending ? (
        <LoadingState label="Loading assets…" rows={2} />
      ) : null}
      {assets.isError ? (
        <ErrorState
          message={assets.error.message}
          onRetry={retry}
          retryLabel="Retry assets"
        />
      ) : null}
      {!assets.isError && assets.data?.length === 0 ? (
        <p>
          {filtered
            ? "No assets match your filters."
            : "No assets in this estate."}
        </p>
      ) : null}
      {assets.data?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Select</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.data.map((asset) => (
              <AssetChoice
                asset={asset}
                category={categoryLabel(categories.data, asset.category)}
                disabled={disabled}
                key={asset.id}
                onSelect={onSelect}
                selected={selected?.id === asset.id}
              />
            ))}
          </TableBody>
        </Table>
      ) : null}
    </section>
  );
}
