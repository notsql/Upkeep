import { Field, FieldDescription, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { type ChangeEvent, useCallback } from "react";
import { deviceMetrics } from "@/lib/devices";
import type { ManualReadingFields } from "@/lib/manual-reading-form";
import type { ReadingAsset, ReadingMetricOption } from "@/lib/readings";
import { ReadingAssetPicker } from "../../-components/reading-asset-picker";

export function ManualMeasurementFields({
  estateId,
  fields,
  assetLabel,
  metrics,
  selectedMetric,
  onChange,
  onChoose,
}: {
  estateId: string;
  fields: ManualReadingFields;
  assetLabel: string;
  metrics: ReadingMetricOption[];
  selectedMetric?: ReadingMetricOption;
  onChange: (fields: Partial<ManualReadingFields>) => void;
  onChoose: (asset: ReadingAsset | undefined) => void;
}) {
  const metricChange = useCallback(
    (metric: string | null) => onChange({ metric: metric ?? "" }),
    [onChange]
  );
  const valueChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange({ value: event.target.value }),
    [onChange]
  );
  const timeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange({ measuredAt: event.target.value }),
    [onChange]
  );
  return (
    <>
      <Field>
        <FieldLabel>Asset</FieldLabel>
        <ReadingAssetPicker
          estateId={estateId}
          label={assetLabel}
          mode="record"
          onChoose={onChoose}
        />
      </Field>
      <Field>
        <FieldLabel>Metric</FieldLabel>
        <Select onValueChange={metricChange} value={fields.metric}>
          <SelectTrigger aria-label="Metric" className="w-full">
            <SelectValue>
              {selectedMetric
                ? deviceMetrics[selectedMetric.metric].name
                : "Choose metric"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {metrics.map((metric) => (
              <SelectItem key={metric.metric} value={metric.metric}>
                {deviceMetrics[metric.metric].name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="manual-reading-value">Value</FieldLabel>
        <Input
          id="manual-reading-value"
          onChange={valueChange}
          required
          step="any"
          type="number"
          value={fields.value}
        />
        {selectedMetric ? (
          <FieldDescription>
            Unit: {selectedMetric.unit} · Expected range:{" "}
            {selectedMetric.validMin} to {selectedMetric.validMax}{" "}
            {selectedMetric.unit}
          </FieldDescription>
        ) : null}
      </Field>
      <Field>
        <FieldLabel htmlFor="manual-reading-time">Measured at</FieldLabel>
        <Input
          id="manual-reading-time"
          onChange={timeChange}
          required
          type="datetime-local"
          value={fields.measuredAt}
        />
        <FieldDescription>
          Use your local time. Backdated measurements are allowed.
        </FieldDescription>
      </Field>
    </>
  );
}
