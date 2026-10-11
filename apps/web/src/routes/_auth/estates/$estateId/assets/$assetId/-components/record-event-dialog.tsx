import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { Textarea } from "@proj/ui/components/textarea";
import {
  type ChangeEvent,
  type SubmitEvent,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";
import { localToday } from "@/lib/assessments";
import {
  type AssetEventInput,
  type AssetEventType,
  assetEventTypeLabel,
} from "@/lib/asset-events";

interface FormValues {
  notes: string;
  occurredOn: string;
  type: string;
}

type Field = keyof FormValues;
type FieldErrors = Partial<Record<Field, string>>;

const typeItems = [
  { value: "", label: "Select a type" },
  ...Object.entries(assetEventTypeLabel).map(([value, label]) => ({
    value,
    label,
  })),
];

function isEventType(value: string): value is AssetEventType {
  return value in assetEventTypeLabel;
}

function validate(values: FormValues, today: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!isEventType(values.type)) {
    errors.type = "Type is required.";
  }
  if (!values.occurredOn) {
    errors.occurredOn = "Event date is required.";
  } else if (values.occurredOn > today) {
    // ISO dates compare correctly as strings.
    errors.occurredOn = "The event date cannot be in the future.";
  }
  if (!values.notes.trim()) {
    errors.notes = "Notes are required.";
  }
  return errors;
}

export function RecordEventDialog({
  defaultType,
  onSave,
  onCancel,
}: {
  defaultType?: AssetEventType;
  onSave: (values: AssetEventInput) => Promise<unknown>;
  onCancel: () => void;
}) {
  const id = useId();
  const [today] = useState(localToday);
  const [values, setValues] = useState<FormValues>({
    type: defaultType ?? "",
    occurredOn: today,
    notes: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  // State updates are async, so a ref blocks a second submit in the same tick.
  const submitting = useRef(false);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target;
      setValues((current) => ({ ...current, [name]: value }));
    },
    []
  );

  const handleTypeChange = useCallback((value: string | null) => {
    setValues((current) => ({ ...current, type: value ?? "" }));
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!(open || submitting.current)) {
        onCancel();
      }
    },
    [onCancel]
  );

  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting.current) {
        return;
      }
      const errors = validate(values, today);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0 || !isEventType(values.type)) {
        return;
      }
      submitting.current = true;
      setPending(true);
      setError(undefined);
      try {
        await onSave({
          type: values.type,
          occurredOn: values.occurredOn,
          notes: values.notes.trim(),
        });
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to record the event. Please try again."
        );
      } finally {
        submitting.current = false;
        setPending(false);
      }
    },
    [onSave, today, values]
  );

  const errorProps = (field: Field) =>
    fieldErrors[field]
      ? { "aria-describedby": `${id}-${field}-error`, "aria-invalid": true }
      : {};
  const errorText = (field: Field) =>
    fieldErrors[field] ? (
      <p className="text-destructive text-sm" id={`${id}-${field}-error`}>
        {fieldErrors[field]}
      </p>
    ) : null;

  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Record event</DialogTitle>
          <DialogDescription>
            Record what happened to this asset, when, and any notes.
          </DialogDescription>
        </DialogHeader>
        <form className="mt-4 grid gap-5" noValidate onSubmit={handleSubmit}>
          <fieldset className="grid gap-5" disabled={pending}>
            <legend className="sr-only">Asset event</legend>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-type`}>Type</Label>
              <Select
                items={typeItems}
                onValueChange={handleTypeChange}
                required
                value={values.type}
              >
                <SelectTrigger
                  {...errorProps("type")}
                  className="w-full"
                  id={`${id}-type`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeItems.slice(1).map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errorText("type")}
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-occurred-on`}>Event date</Label>
              <Input
                {...errorProps("occurredOn")}
                id={`${id}-occurred-on`}
                max={today}
                name="occurredOn"
                onChange={handleChange}
                required
                type="date"
                value={values.occurredOn}
              />
              {errorText("occurredOn")}
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-notes`}>Notes</Label>
              <Textarea
                {...errorProps("notes")}
                id={`${id}-notes`}
                maxLength={2000}
                name="notes"
                onChange={handleChange}
                required
                value={values.notes}
              />
              {errorText("notes")}
            </div>
          </fieldset>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={pending}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : "Record event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
