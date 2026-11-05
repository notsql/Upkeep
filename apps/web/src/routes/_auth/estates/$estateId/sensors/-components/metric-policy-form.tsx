import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { type ChangeEvent, useCallback, useId, useState } from "react";
import { FormDialog } from "@/components/form-dialog";
import {
  type SensorPolicy,
  useSetFlatlinePolicy,
} from "@/lib/flatlined-sensors";
import {
  metricLabel,
  wholeMinutes,
} from "@/routes/_auth/estates/$estateId/sensors/-components/sensor-format";

const TOLERANCE = /^\d{1,12}(?:\.\d{1,6})?$/u;

export function useMetricPolicyEditor({
  estateId,
  policy,
  onClose,
  canManage,
}: {
  estateId: string;
  policy: SensorPolicy | undefined;
  onClose: () => void;
  canManage: boolean;
}) {
  const save = useSetFlatlinePolicy(estateId, policy?.metric ?? "TEMPERATURE");
  const [duration, setDuration] = useState("");
  const [unit, setUnit] = useState<"minutes" | "hours">("minutes");
  const [tolerance, setTolerance] = useState("0");
  const [validation, setValidation] = useState<string>();
  const { isPending, mutate, reset } = save;
  const startEditing = useCallback(
    (selectedPolicy: SensorPolicy) => {
      setDuration(selectedPolicy.durationMinutes?.toString() ?? "");
      setUnit("minutes");
      setTolerance(selectedPolicy.tolerance.toString());
      setValidation(undefined);
      reset();
    },
    [reset]
  );
  const handleSubmit = useCallback(() => {
    if (isPending || !canManage || !policy) {
      return;
    }
    setValidation(undefined);
    reset();
    try {
      const durationMinutes = wholeMinutes(duration, unit, 43_200);
      const value = Number(tolerance);
      if (
        !(TOLERANCE.test(tolerance) && Number.isFinite(value)) ||
        value < 0 ||
        value >= 1e12
      ) {
        throw new Error(
          "Tolerance must be non-negative, with at most 12 digits before and 6 after the decimal point."
        );
      }
      mutate(
        { durationMinutes, tolerance: value },
        {
          onSuccess: onClose,
        }
      );
    } catch (error) {
      setValidation(
        error instanceof Error ? error.message : "Check the policy values."
      );
    }
  }, [
    canManage,
    duration,
    isPending,
    mutate,
    onClose,
    policy,
    reset,
    tolerance,
    unit,
  ]);
  const changeDuration = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setDuration(event.target.value),
    []
  );
  const changeUnit = useCallback((value: string | null) => {
    if (value === "minutes" || value === "hours") {
      setUnit(value);
    }
  }, []);
  // The dialog only opens for managers, so losing that right mid-edit means
  // the review failed to load: keep the draft but do not save it.
  const errorMessage =
    validation ||
    save.error?.message ||
    (canManage ? undefined : "Saving is paused until device metrics load");
  const changeTolerance = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setTolerance(event.target.value),
    []
  );
  return {
    duration,
    unit,
    tolerance,
    errorMessage,
    isPending,
    handleSubmit,
    changeDuration,
    changeUnit,
    changeTolerance,
    startEditing,
  };
}

/** The metric policy editor, opened in a FormDialog from its row's Edit / Set up button. */
export function MetricPolicyDialog({
  policy,
  onClose,
  canManage,
  editor,
}: {
  policy: SensorPolicy | undefined;
  onClose: () => void;
  canManage: boolean;
  editor: ReturnType<typeof useMetricPolicyEditor>;
}) {
  const label = policy ? metricLabel(policy.metric) : "";
  let description: string | undefined;
  if (policy) {
    description =
      policy.durationMinutes === null
        ? "Not configured"
        : `Current: ${policy.durationMinutes} minutes · tolerance ${policy.tolerance} ${policy.unit}`;
  }
  return (
    <FormDialog
      description={description}
      error={editor.errorMessage}
      onClose={onClose}
      onSubmit={editor.handleSubmit}
      open={Boolean(policy)}
      pending={editor.isPending}
      submitDisabled={!canManage}
      submitLabel="Save policy"
      title={`${label} policy`}
    >
      {policy ? (
        <MetricPolicyFields
          canManage={canManage}
          editor={editor}
          key={policy.metric}
          policy={policy}
        />
      ) : null}
    </FormDialog>
  );
}

function MetricPolicyFields({
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
