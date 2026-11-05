import { Checkbox } from "@proj/ui/components/checkbox";
import { Label } from "@proj/ui/components/label";
import { useCallback } from "react";
import type { DeviceMetric } from "@/lib/devices";

export function MetricOption({
  checked,
  disabled,
  id,
  label,
  metric,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  id: string;
  label: string;
  metric: DeviceMetric;
  onChange: (metric: DeviceMetric, checked: boolean) => void;
}) {
  const handleCheckedChange = useCallback(
    (next: boolean) => onChange(metric, next),
    [metric, onChange]
  );
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2">
      <Checkbox
        checked={checked}
        disabled={disabled}
        id={id}
        name="metrics"
        onCheckedChange={handleCheckedChange}
        value={metric}
      />
      <Label className="text-sm" htmlFor={id}>
        {label}
      </Label>
    </div>
  );
}
