import type { Asset } from "@/lib/assets";
import { useAssetCategories } from "@/lib/catalogue";
import { formatDate } from "@/lib/format";

interface SummaryItem {
  label: string;
  /** Visible labels only where the value alone would be ambiguous. */
  showLabel: boolean;
  value: string;
}

/** "Manufacturer Model", or the one name when both are recorded the same. */
function makeAndModel(
  manufacturer: string | null | undefined,
  model: string | null | undefined
): string {
  if (manufacturer && model && manufacturer.trim() === model.trim()) {
    return manufacturer.trim();
  }
  return [manufacturer, model].filter(Boolean).join(" ");
}

function summaryItems(asset: Asset, category: string): SummaryItem[] {
  const make = makeAndModel(asset.manufacturer, asset.model);
  const items: (SummaryItem | null)[] = [
    { label: "Category", showLabel: false, value: category },
    asset.locationPath
      ? { label: "Location", showLabel: false, value: asset.locationPath }
      : null,
    asset.installedOn
      ? {
          label: "Installed",
          showLabel: true,
          value: formatDate(asset.installedOn),
        }
      : null,
    make ? { label: "Make and model", showLabel: false, value: make } : null,
    asset.serialNumber
      ? { label: "Serial", showLabel: true, value: asset.serialNumber }
      : null,
  ];
  return items.filter((item): item is SummaryItem => item !== null);
}

/** One muted line of the asset's recorded details; unrecorded ones are left out. */
export function AssetSummary({ asset }: { asset: Asset }) {
  const categories = useAssetCategories();
  const category =
    categories.data?.find((item) => item.code === asset.category)?.label ??
    asset.category;
  return (
    <ul
      aria-label="Asset details"
      className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm [&>li+li]:before:mr-2 [&>li+li]:before:content-['·']"
    >
      {summaryItems(asset, category).map((item) => (
        <li className="wrap-anywhere" key={item.label}>
          <span
            className={
              item.showLabel ? "text-muted-foreground text-xs" : "sr-only"
            }
          >
            {item.label}
          </span>{" "}
          <span className="text-foreground">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}
