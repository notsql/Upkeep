import { Button } from "@proj/ui/components/button";
import { Checkbox } from "@proj/ui/components/checkbox";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { type ChangeEvent, useCallback } from "react";
import { deviceMetrics } from "@/lib/devices";
import type { ReadingSearch } from "@/lib/reading-filters";
import type { ReadingAsset } from "@/lib/readings";
import { ReadingAssetPicker } from "./reading-asset-picker";

export function ReadingFilterControls({
  estateId,
  assetLabel,
  filters,
  error,
  onChoose,
  onFiltersChange,
}: {
  estateId: string;
  assetLabel: string;
  filters: ReadingSearch;
  error?: string;
  onChoose: (asset: ReadingAsset | undefined) => void;
  onFiltersChange: (filters: ReadingSearch) => void;
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
    (event: ChangeEvent<HTMLInputElement>) =>
      change({ from: event.target.value || undefined }),
    [change]
  );
  const toChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      change({ to: event.target.value || undefined }),
    [change]
  );
  const suspectChange = useCallback(
    (checked: boolean) => change({ suspect: checked || undefined }),
    [change]
  );
  const clear = useCallback(() => onFiltersChange({}), [onFiltersChange]);
  return (
    <section
      aria-label="Reading filters"
      className="section-surface grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <Field className="min-w-0">
        <FieldLabel>Asset</FieldLabel>
        <ReadingAssetPicker
          estateId={estateId}
          label={assetLabel}
          onChoose={onChoose}
        />
      </Field>
      <Field className="min-w-0">
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
      <Field className="min-w-0">
        <FieldLabel htmlFor="estate-readings-from">From</FieldLabel>
        <Input
          aria-describedby={error ? "reading-filter-error" : undefined}
          id="estate-readings-from"
          onChange={fromChange}
          type="datetime-local"
          value={filters.from ?? ""}
        />
      </Field>
      <Field className="min-w-0">
        <FieldLabel htmlFor="estate-readings-to">To (exclusive)</FieldLabel>
        <Input
          aria-describedby={error ? "reading-filter-error" : undefined}
          id="estate-readings-to"
          onChange={toChange}
          type="datetime-local"
          value={filters.to ?? ""}
        />
      </Field>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={!!filters.suspect}
          id="estate-readings-suspect"
          onCheckedChange={suspectChange}
        />
        <Label htmlFor="estate-readings-suspect">Suspect only</Label>
      </div>
      <Button onClick={clear} variant="outline">
        Clear filters
      </Button>
    </section>
  );
}
