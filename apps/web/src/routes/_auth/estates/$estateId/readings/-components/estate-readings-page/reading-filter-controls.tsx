import { Checkbox } from "@proj/ui/components/checkbox";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { useCallback } from "react";
import { FilterBar } from "@/components/filters/filter-bar";
import { DateTimePicker } from "@/components/forms/date-time-picker";
import { deviceMetrics } from "@/lib/devices";
import type { ReadingSearch } from "@/lib/reading-filters";
import type { ReadingAsset } from "@/lib/readings";
import { ReadingAssetPicker } from "@/routes/_auth/estates/$estateId/readings/-components/reading-asset-picker/reading-asset-picker";

export function countReadingFilters(filters: ReadingSearch): number {
  return [
    filters.assetId,
    filters.metric,
    filters.from,
    filters.to,
    filters.suspect,
  ].filter(Boolean).length;
}

export function ReadingFilterControls({
  estateId,
  assetLabel,
  filters,
  error,
  onChoose,
  onFiltersChange,
  id,
  open,
}: {
  estateId: string;
  assetLabel: string;
  filters: ReadingSearch;
  error?: string;
  onChoose: (asset: ReadingAsset | undefined) => void;
  onFiltersChange: (filters: ReadingSearch) => void;
  /** From `useFilterPanel(...).barProps`; omit to always show the bar. */
  id?: string;
  open?: boolean;
}) {
  const change = useCallback(
    (next: Partial<ReadingSearch>) =>
      onFiltersChange({ ...filters, ...next, page: undefined }),
    [filters, onFiltersChange]
  );
  const metricChange = useCallback(
    (metric: string | null) => change({ metric: metric || undefined }),
    [change]
  );
  const fromChange = useCallback(
    (from: string) => change({ from: from || undefined }),
    [change]
  );
  const toChange = useCallback(
    (to: string) => change({ to: to || undefined }),
    [change]
  );
  const suspectChange = useCallback(
    (checked: boolean) => change({ suspect: checked || undefined }),
    [change]
  );
  const clear = useCallback(() => onFiltersChange({}), [onFiltersChange]);
  const activeCount = countReadingFilters(filters);
  return (
    <FilterBar
      activeCount={activeCount}
      id={id}
      label="Reading filters"
      onClear={clear}
      open={open}
    >
      <Field className="w-full sm:w-48">
        <FieldLabel>Asset</FieldLabel>
        <ReadingAssetPicker
          estateId={estateId}
          label={assetLabel}
          onChoose={onChoose}
        />
      </Field>
      <Field className="w-full sm:w-48">
        <FieldLabel>Metric</FieldLabel>
        <Select onValueChange={metricChange} value={filters.metric ?? ""}>
          <SelectTrigger aria-label="Metric" className="w-full">
            <SelectValue>
              {filters.metric
                ? (deviceMetrics[filters.metric as keyof typeof deviceMetrics]
                    ?.name ?? "Invalid metric")
                : "All metrics"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All metrics</SelectItem>
            {Object.entries(deviceMetrics).map(([value, metric]) => (
              <SelectItem key={value} value={value}>
                {metric.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="w-full sm:w-48">
        <FieldLabel htmlFor="estate-readings-from">From</FieldLabel>
        <DateTimePicker
          aria-describedby={error ? "reading-filter-error" : undefined}
          aria-label="From"
          id="estate-readings-from"
          onChange={fromChange}
          value={filters.from ?? ""}
        />
      </Field>
      <Field className="w-full sm:w-48">
        <FieldLabel htmlFor="estate-readings-to">To (exclusive)</FieldLabel>
        <DateTimePicker
          aria-describedby={error ? "reading-filter-error" : undefined}
          aria-label="To (exclusive)"
          id="estate-readings-to"
          onChange={toChange}
          value={filters.to ?? ""}
        />
      </Field>
      <div className="flex h-9 items-center gap-2">
        <Checkbox
          checked={!!filters.suspect}
          id="estate-readings-suspect"
          onCheckedChange={suspectChange}
        />
        <Label htmlFor="estate-readings-suspect">Suspect only</Label>
      </div>
    </FilterBar>
  );
}
