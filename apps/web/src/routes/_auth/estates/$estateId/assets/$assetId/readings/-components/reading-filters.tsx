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
import { useCallback } from "react";
import { FilterBar } from "@/components/filter-bar";
import { type DeviceMetric, deviceMetrics } from "@/lib/devices";
import type { ReadingFilters } from "@/lib/readings";

const metricOptions: Record<string, string> = {
  "": "All metrics",
  ...Object.fromEntries(
    Object.entries(deviceMetrics).map(([metric, { name }]) => [metric, name])
  ),
};

/** Every change returns to the first page. */
export function ReadingFilterControls({
  filters,
  onChange,
}: {
  filters: ReadingFilters;
  onChange: (filters: ReadingFilters) => void;
}) {
  const change = useCallback(
    (next: Partial<ReadingFilters>) =>
      onChange({ ...filters, ...next, page: undefined }),
    [filters, onChange]
  );
  const metric = useCallback(
    (chosen: string | null) =>
      change({ metric: (chosen as DeviceMetric) || undefined }),
    [change]
  );
  const from = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      change({ from: event.target.value || undefined }),
    [change]
  );
  const to = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      change({ to: event.target.value || undefined }),
    [change]
  );
  const suspect = useCallback(
    (checked: boolean) => change({ suspect: checked || undefined }),
    [change]
  );
  const value = filters.metric ?? "";
  return (
    <FilterBar label="Filter readings">
      <Field className="w-full sm:w-48">
        <FieldLabel>Metric</FieldLabel>
        <Select onValueChange={metric} value={value}>
          <SelectTrigger aria-label="Metric" className="w-full">
            <SelectValue>{metricOptions[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(metricOptions).map(([key, text]) => (
              <SelectItem key={key} value={key}>
                {text}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="w-full sm:w-48">
        <FieldLabel htmlFor="readings-from">From</FieldLabel>
        <Input
          id="readings-from"
          onChange={from}
          type="datetime-local"
          value={filters.from ?? ""}
        />
      </Field>
      <Field className="w-full sm:w-48">
        <FieldLabel htmlFor="readings-to">To</FieldLabel>
        <Input
          id="readings-to"
          onChange={to}
          type="datetime-local"
          value={filters.to ?? ""}
        />
      </Field>
      <div className="flex min-h-9 items-center gap-2">
        <Checkbox
          checked={Boolean(filters.suspect)}
          id="readings-suspect"
          onCheckedChange={suspect}
        />
        <Label htmlFor="readings-suspect">Suspect only</Label>
      </div>
    </FilterBar>
  );
}
