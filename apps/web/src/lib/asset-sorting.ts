import type { Asset } from "@/lib/assets";
import { categoryLabel } from "@/lib/catalogue";

export const assetSortOptions = [
  { value: "REFERENCE", label: "Reference" },
  { value: "NAME", label: "Name" },
  { value: "CATEGORY", label: "Category" },
  { value: "LOCATION", label: "Location" },
  { value: "CONDITION", label: "Current condition" },
  { value: "STATUS", label: "Status" },
] as const;
export type AssetSortColumn = (typeof assetSortOptions)[number]["value"];
// Presentation state only; asset API filters remain generated AssetFilters.
export interface AssetSort {
  direction?: "ASC" | "DESC";
  sortBy?: AssetSortColumn;
}
const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});
const conditionRank = { GOOD: 0, NEEDS_ATTENTION: 1, FAULTY: 2 };

export function sortAssets(
  assets: readonly Asset[],
  sort: AssetSort,
  categories: Parameters<typeof categoryLabel>[0]
): Asset[] {
  const column = sort.sortBy ?? "REFERENCE";
  const sign = sort.direction === "DESC" ? -1 : 1;
  const value = (asset: Asset): string | number => {
    switch (column) {
      case "REFERENCE":
        return asset.reference;
      case "NAME":
        return asset.name;
      case "CATEGORY":
        return categoryLabel(categories, asset.category);
      case "LOCATION":
        return asset.locationPath;
      case "STATUS":
        return asset.deactivatedAt ? 1 : 0;
      case "CONDITION":
        return asset.currentCondition
          ? conditionRank[asset.currentCondition]
          : -1;
      default:
        return asset.reference;
    }
  };
  return [...assets].sort((a, b) => {
    if (column === "CONDITION" && !(a.currentCondition && b.currentCondition)) {
      const unassessed =
        Number(!a.currentCondition) - Number(!b.currentCondition);
      if (unassessed) {
        return unassessed;
      }
    }
    const av = value(a);
    const bv = value(b);
    const comparison =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : collator.compare(String(av), String(bv));
    return (
      sign * comparison ||
      collator.compare(a.reference, b.reference) ||
      a.id.localeCompare(b.id)
    );
  });
}
