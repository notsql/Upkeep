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
import { Field, FieldError, FieldLabel } from "@proj/ui/components/field";
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
  type SubmitEvent,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";
import {
  INTERVAL_UNITS,
  type IntervalUnit,
  type ServiceInterval,
} from "@/lib/service-intervals";

const WHOLE_NUMBER = /^\d+$/u;

const unitItems = Object.entries(INTERVAL_UNITS).map(([value, unit]) => ({
  value,
  label: unit.label,
}));

function isUnit(value: string): value is IntervalUnit {
  return value in INTERVAL_UNITS;
}

/** A whole number within the unit's limit, or undefined. */
function parse(value: string, unit: IntervalUnit): number | undefined {
  const trimmed = value.trim();
  if (!WHOLE_NUMBER.test(trimmed)) {
    return;
  }
  const number = Number(trimmed);
  return number >= 1 && number <= INTERVAL_UNITS[unit].max ? number : undefined;
}

/** Sets or clears a service interval as a value and a unit (ID-81). */
export function ServiceIntervalDialog({
  title,
  description,
  interval,
  onSave,
  onCancel,
}: {
  title: string;
  description: string;
  interval: ServiceInterval | null;
  onSave: (interval: ServiceInterval | null) => Promise<unknown>;
  onCancel: () => void;
}) {
  const id = useId();
  const [value, setValue] = useState(interval ? String(interval.value) : "");
  const [unit, setUnit] = useState<IntervalUnit>(interval?.unit ?? "MONTH");
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  // State updates are async, so a ref blocks a second save in the same tick.
  const saving = useRef<boolean>(false);

  const save = useCallback(
    async (next: ServiceInterval | null) => {
      if (saving.current) {
        return;
      }
      saving.current = true;
      setPending(true);
      setError(undefined);
      try {
        await onSave(next);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn't save. Please try again."
        );
      } finally {
        saving.current = false;
        setPending(false);
      }
    },
    [onSave]
  );

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  }, []);

  const handleUnitChange = useCallback((next: string | null) => {
    if (next && isUnit(next)) {
      setUnit(next);
    }
  }, []);

  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      const next = parse(value, unit);
      setInvalid(next === undefined);
      if (next !== undefined) {
        save({ value: next, unit });
      }
    },
    [save, unit, value]
  );

  const handleClear = useCallback(() => save(null), [save]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!(open || saving.current)) {
        onCancel();
      }
    },
    [onCancel]
  );

  const limit = INTERVAL_UNITS[unit];

  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="mt-4 grid gap-5" noValidate onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor={`${id}-value`}>Every</FieldLabel>
              <Input
                disabled={pending}
                id={`${id}-value`}
                inputMode="numeric"
                max={limit.max}
                min={1}
                onChange={handleChange}
                step={1}
                type="number"
                value={value}
                {...(invalid
                  ? { "aria-describedby": `${id}-error`, "aria-invalid": true }
                  : {})}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-unit`}>Unit</FieldLabel>
              <Select
                disabled={pending}
                items={unitItems}
                onValueChange={handleUnitChange}
                value={unit}
              >
                <SelectTrigger className="w-full" id={`${id}-unit`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unitItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {invalid ? (
            <FieldError id={`${id}-error`}>
              {`Enter a whole number of ${limit.many} from 1 to ${limit.max}.`}
            </FieldError>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            {interval === null ? null : (
              <Button
                disabled={pending}
                onClick={handleClear}
                type="button"
                variant="outline"
              >
                Clear
              </Button>
            )}
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
