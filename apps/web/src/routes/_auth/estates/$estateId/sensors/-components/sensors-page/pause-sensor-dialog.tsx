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
import { FormDialog } from "@/components/dialogs/form-dialog";
import {
  type MonitoredSensor,
  usePauseFlatlineSensor,
} from "@/lib/flatlined-sensors";
import {
  metricLabel,
  wholeMinutes,
} from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-format";

export function PauseSensorDialog({
  estateId,
  sensor,
  onClose,
}: {
  estateId: string;
  sensor: MonitoredSensor;
  onClose: () => void;
}) {
  const id = useId();
  const pause = usePauseFlatlineSensor(estateId, sensor);
  const [duration, setDuration] = useState("");
  const [unit, setUnit] = useState<"minutes" | "hours">("minutes");
  const [validation, setValidation] = useState<string>();
  const { isPending, mutate, reset } = pause;
  const handleSubmit = useCallback(() => {
    if (isPending) {
      return;
    }
    setValidation(undefined);
    reset();
    try {
      mutate(
        { durationMinutes: wholeMinutes(duration, unit, 10_080) },
        { onSuccess: onClose }
      );
    } catch (error) {
      setValidation(
        error instanceof Error ? error.message : "Check the pause duration."
      );
    }
  }, [duration, isPending, mutate, onClose, reset, unit]);
  const changeDuration = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setDuration(event.target.value),
    []
  );
  const changeUnit = useCallback((value: string | null) => {
    if (value === "minutes" || value === "hours") {
      setUnit(value);
    }
  }, []);
  const errorMessage = validation || pause.error?.message;
  return (
    <FormDialog
      description="Only this device and metric will be paused. Readings continue to be stored. Detection starts fresh after the pause expires automatically. Maximum: 7 days."
      error={errorMessage}
      onClose={onClose}
      onSubmit={handleSubmit}
      open
      pending={pause.isPending}
      pendingLabel="Starting pause…"
      submitLabel="Start pause"
      title={`Pause ${sensor.deviceIdentifier} ${metricLabel(sensor.metric).toLowerCase()}`}
    >
      <Field>
        <FieldLabel htmlFor={`${id}-duration`}>Pause duration</FieldLabel>
        <Input
          disabled={pause.isPending}
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
          disabled={pause.isPending}
          onValueChange={changeUnit}
          value={unit}
        >
          <SelectTrigger className="w-full" id={`${id}-unit`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">Minutes</SelectItem>
            <SelectItem value="hours">Hours</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </FormDialog>
  );
}
