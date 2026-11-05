import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { useId } from "react";
import type { SensorPolicy } from "@/lib/flatlined-sensors";
import { metricLabel } from "@/routes/_auth/estates/$estateId/sensors/-components/sensor-format";

import type { useMetricPolicyEditor } from "./use-metric-policy-editor";

export function MetricPolicyFields({
  policy,
  canManage,
  editor,
}: {
  policy: SensorPolicy;
  canManage: boolean;
  editor: ReturnType<typeof useMetricPolicyEditor>;
}) {
  const id = useId();
  const label = metricLabel(policy.metric);
  const {
    duration,
    unit,
    tolerance,
    isPending,
    changeDuration,
    changeUnit,
    changeTolerance,
  } = editor;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-duration`}>Threshold</FieldLabel>
          <Input
            disabled={isPending || !canManage}
            id={`${id}-duration`}
            min={1}
            onChange={changeDuration}
            required
            step={1}
            type="number"
            value={duration}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-unit`}>Time unit</FieldLabel>
          <Select
            disabled={isPending || !canManage}
            onValueChange={changeUnit}
            value={unit}
          >
            <SelectTrigger className="w-full" id={`${id}-unit`}>
              <SelectValue>
                {unit === "minutes" ? "Minutes" : "Hours"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={`${id}-tolerance`}>
          Tolerance ({policy.unit})
        </FieldLabel>
        <Input
          disabled={isPending || !canManage}
          id={`${id}-tolerance`}
          min={0}
          onChange={changeTolerance}
          required
          step="0.000001"
          type="number"
          value={tolerance}
        />
      </Field>
      <p className="text-muted-foreground text-sm">
        Zero requires exact matching. This policy applies to{" "}
        {label.toLowerCase()} readings from every device in this estate. Maximum
        threshold: 30 days.
      </p>
    </>
  );
}
