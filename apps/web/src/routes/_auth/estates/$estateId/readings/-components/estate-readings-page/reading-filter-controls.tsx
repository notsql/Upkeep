import { Button } from "@proj/ui/components/button";
import { Checkbox } from "@proj/ui/components/checkbox";
import {
  Collapsible,
  CollapsibleContent,
} from "@proj/ui/components/collapsible";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@proj/ui/components/field";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { X } from "lucide-react";
import { type ReactNode, useCallback } from "react";
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
    filters.anomalous,
  ].filter(Boolean).length;
}

/**
 * The filter fields as a light panel. The ReadingToolbar's Filters button
 * names it, so it has no heading of its own; Clear filters ends the row.
 */
function ReadingFilterPanel({
  id,
  open,
  onClear,
  children,
}: {
  id?: string;
  open?: boolean;
  onClear?: () => void;
  children: ReactNode;
}) {
  const panel = (
    <search
      aria-label="Reading filters"
      className="rounded-lg border p-3"
      // biome-ignore lint/a11y/noRedundantRoles: jsdom does not yet map <search> to the search role.
      role="search"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {children}
        {onClear ? (
          <Button
            className="sm:ml-auto"
            onClick={onClear}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </search>
  );
  if (open === undefined) {
    return id ? <div id={id}>{panel}</div> : panel;
  }
  return (
    <Collapsible open={open}>
      <CollapsibleContent id={id}>{panel}</CollapsibleContent>
    </Collapsible>
  );
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
  filters: ReadingSearch;
  error?: string;
  /** Omit with `onChoose` where the asset is fixed (an asset's own readings). */
  estateId?: string;
  assetLabel?: string;
  onChoose?: (asset: ReadingAsset | undefined) => void;
  onFiltersChange: (filters: ReadingSearch) => void;
  /** From `useFilterPanel(...).barProps`; omit to always show the panel. */
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
  const anomalousChange = useCallback(
    (checked: boolean) => change({ anomalous: checked || undefined }),
    [change]
  );
  const clear = useCallback(() => onFiltersChange({}), [onFiltersChange]);
  const activeCount = countReadingFilters(filters);
  return (
    <ReadingFilterPanel
      id={id}
      onClear={activeCount > 0 ? clear : undefined}
      open={open}
    >
      {estateId && onChoose ? (
        <Field className="w-full sm:w-48">
          <FieldLabel>Asset</FieldLabel>
          <ReadingAssetPicker
            estateId={estateId}
            label={assetLabel ?? "All assets"}
            onChoose={onChoose}
          />
        </Field>
      ) : null}
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
      <Field className="w-full sm:w-auto">
        <FieldLabel htmlFor="estate-readings-from">From</FieldLabel>
        <DateTimePicker
          aria-describedby={error ? "reading-filter-error" : undefined}
          aria-label="From"
          id="estate-readings-from"
          onChange={fromChange}
          value={filters.from ?? ""}
        />
      </Field>
      <Field className="w-full sm:w-auto">
        <FieldLabel htmlFor="estate-readings-to">To (exclusive)</FieldLabel>
        <DateTimePicker
          aria-describedby={error ? "reading-filter-error" : undefined}
          aria-label="To (exclusive)"
          id="estate-readings-to"
          onChange={toChange}
          value={filters.to ?? ""}
        />
      </Field>
      <FieldSet className="w-full gap-0 sm:w-auto">
        <FieldLegend className="mb-3" variant="label">
          Flags
        </FieldLegend>
        <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={!!filters.suspect}
              id="estate-readings-suspect"
              onCheckedChange={suspectChange}
            />
            <Label htmlFor="estate-readings-suspect">Suspect only</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={!!filters.anomalous}
              id="estate-readings-anomalous"
              onCheckedChange={anomalousChange}
            />
            <Label htmlFor="estate-readings-anomalous">Anomalous only</Label>
          </div>
        </div>
      </FieldSet>
    </ReadingFilterPanel>
  );
}
