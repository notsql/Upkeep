import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  type SensorPolicy,
  useSetFlatlinePolicy,
} from "@/lib/flatlined-sensors";
import {
  metricLabel,
  wholeMinutes,
} from "@/routes/_auth/estates/$estateId/sensors/-components/sensor-format";

const TOLERANCE = /^\d{1,12}(\.\d{1,6})?$/;

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
  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
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
    },
    [
      canManage,
      duration,
      isPending,
      mutate,
      onClose,
      policy,
      reset,
      tolerance,
      unit,
    ]
  );
  const changeDuration = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setDuration(event.target.value),
    []
  );
  const changeUnit = useCallback((value: string | null) => {
    if (value === "minutes" || value === "hours") {
      setUnit(value);
    }
  }, []);
  const errorMessage = validation || save.error?.message;
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

export function MetricPolicyForm({
  policy,
  id: editorId,
  onClose,
  canManage,
  editor,
}: {
  policy: SensorPolicy;
  id: string;
  onClose: () => void;
  canManage: boolean;
  editor: ReturnType<typeof useMetricPolicyEditor>;
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView?.({ block: "nearest" });
  }, []);
  const label = metricLabel(policy.metric);
  const {
    duration,
    unit,
    tolerance,
    errorMessage,
    isPending,
    handleSubmit,
    changeDuration,
    changeUnit,
    changeTolerance,
  } = editor;
  return (
    <div className="rounded-xl bg-muted/40 p-4 sm:p-6" id={editorId}>
      <h3 className="mb-4 font-semibold text-base" ref={heading} tabIndex={-1}>
        {label} policy
      </h3>
      <p className="mb-3 text-muted-foreground">
        {policy.durationMinutes === null
          ? "Not configured"
          : `Current threshold: ${policy.durationMinutes} minutes; tolerance: ${policy.tolerance} ${policy.unit}`}
      </p>
      <form
        aria-label={`${label} policy`}
        className="grid gap-3"
        noValidate
        onSubmit={handleSubmit}
      >
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
              <SelectTrigger id={`${id}-unit`}>
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
        <p className="text-muted-foreground">
          Zero requires exact matching. This policy applies to{" "}
          {label.toLowerCase()} readings from every device in this estate.
          Maximum threshold: 30 days.
        </p>
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            disabled={isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          {canManage ? (
            <Button
              aria-label={`Save ${label.toLowerCase()} policy`}
              disabled={isPending}
              type="submit"
            >
              {isPending ? "Saving…" : "Save policy"}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
