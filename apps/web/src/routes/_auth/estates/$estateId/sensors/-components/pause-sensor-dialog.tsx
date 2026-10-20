import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
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
  useId,
  useState,
} from "react";
import {
  type MonitoredSensor,
  usePauseFlatlineSensor,
} from "@/lib/flatlined-sensors";
import {
  metricLabel,
  wholeMinutes,
} from "@/routes/_auth/estates/$estateId/sensors/-components/sensor-format";

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
  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
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
    },
    [duration, isPending, mutate, onClose, reset, unit]
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
  const errorMessage = validation || pause.error?.message;
  const changeOpen = useCallback(
    (open: boolean) => {
      if (!(open || isPending)) {
        onClose();
      }
    },
    [isPending, onClose]
  );
  return (
    <Dialog onOpenChange={changeOpen} open>
      <DialogContent showCloseButton={!pause.isPending}>
        <DialogHeader>
          <DialogTitle>
            Pause {sensor.deviceIdentifier}{" "}
            {metricLabel(sensor.metric).toLowerCase()}
          </DialogTitle>
          <DialogDescription>
            Only this device and metric will be paused. Readings continue to be
            stored. Detection starts fresh after the pause expires
            automatically. Maximum: 7 days.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" noValidate onSubmit={handleSubmit}>
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
              <SelectTrigger id={`${id}-unit`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              disabled={pause.isPending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={pause.isPending} type="submit">
              {pause.isPending ? "Starting pause…" : "Start pause"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
