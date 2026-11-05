import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import type { ChangeEvent } from "react";
import { FilterBar } from "@/components/filters/filter-bar";
import type { AssetFilters } from "@/lib/assets";
import { AssetFilterControls } from "@/routes/_auth/estates/$estateId/assets/-components/asset-filters/asset-filters";
import { MobileAssetFilters } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page/mobile-asset-filters";

export function AssetRegisterFilters({
  activeCount,
  barProps,
  filters,
  locationOptions,
  mobile,
  onChangeSearch,
  onClear,
  onFiltersChange,
  search,
}: {
  activeCount: number;
  barProps: { id: string; open: boolean };
  filters: AssetFilters;
  locationOptions: Record<string, string>;
  mobile: boolean;
  onChangeSearch: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  onClear: () => void;
  onFiltersChange: (filters: AssetFilters) => void;
  search: string;
}) {
  return (
    <FilterBar
      activeCount={activeCount}
      label="Filter assets"
      onClear={onClear}
      {...barProps}
      search={
        <Field>
          <FieldLabel htmlFor="asset-search">Search assets</FieldLabel>
          <Input
            id="asset-search"
            onChange={onChangeSearch}
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
  );
}
