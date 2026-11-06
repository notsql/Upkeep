import { useCallback } from "react";
import { conditionLabel } from "@/lib/assessments";
import type { AssetFilters } from "@/lib/assets";
import { useAssetCategories } from "@/lib/catalogue";
import { FilterSelect } from "@/routes/_auth/estates/$estateId/assets/-components/asset-filters/filter-select";

export function AssetFilterControls({
  filters,
  onChange,
  locations,
  fieldClassName = "w-full sm:w-48",
}: {
  fieldClassName?: string;
  filters: AssetFilters;
  onChange: (filters: AssetFilters) => void;
  locations: Record<string, string>;
}) {
  const categories = useAssetCategories();
  const categoryOptions = Object.fromEntries(
    (categories.data ?? []).map((item) => [item.code, item.label])
  );
  const category = useCallback(
    (value: string) =>
      onChange({
        ...filters,
        category: value || undefined,
      }),
    [filters, onChange]
  );
  const location = useCallback(
    (value: string) => onChange({ ...filters, locationId: value || undefined }),
    [filters, onChange]
  );
  const condition = useCallback(
    (value: string) =>
      onChange({
        ...filters,
        condition: (value as AssetFilters["condition"]) || undefined,
      }),
    [filters, onChange]
  );
  const status = useCallback(
    (value: string) =>
      onChange({ ...filters, status: value as AssetFilters["status"] }),
    [filters, onChange]
  );
  return (
    <>
      <FilterSelect
        className={fieldClassName}
        label="Category"
        onChange={category}
        options={{ "": "All categories", ...categoryOptions }}
        value={filters.category ?? ""}
      />
      <FilterSelect
        className={fieldClassName}
        label="Location"
        onChange={location}
        options={{ "": "All locations", ...locations }}
        value={filters.locationId ?? ""}
      />
      <FilterSelect
        className={fieldClassName}
        label="Condition"
        onChange={condition}
        options={{
          "": "All conditions",
          ...conditionLabel,
          UNASSESSED: "Not assessed yet",
        }}
        value={filters.condition ?? ""}
      />
      <FilterSelect
        className={fieldClassName}
        label="Status"
        onChange={status}
        options={{ ACTIVE: "Active", INACTIVE: "Retired", ALL: "All" }}
        value={filters.status ?? "ACTIVE"}
      />
    </>
  );
}
