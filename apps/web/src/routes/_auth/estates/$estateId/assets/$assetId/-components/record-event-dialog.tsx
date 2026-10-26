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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
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
  downtimeMinutes: string;
  findings: string;
  notes: string;
  occurredOn: string;
  partsReplaced: string;
  serviceProvider: string;
  type: string;
  workPerformed: string;
}

type FieldName = keyof FormValues;
type FieldErrors = Partial<Record<FieldName, string>>;

// Optional text sent only when filled in; left out, it means "not known".
const DETAIL_FIELDS = [
  "findings",
  "workPerformed",
  "serviceProvider",
  "partsReplaced",
] as const;

const WHOLE_NUMBER = /^\d+$/;

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
  if (values.downtimeMinutes && !WHOLE_NUMBER.test(values.downtimeMinutes)) {
    errors.downtimeMinutes = "Downtime must be a whole number of minutes.";
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
    findings: "",
    workPerformed: "",
    serviceProvider: "",
    partsReplaced: "",
    downtimeMinutes: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  // State updates are async, so a ref blocks a second submit in the same tick.
  const submitting = useRef<boolean>(false);

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
      const input: AssetEventInput = {
        type: values.type,
        occurredOn: values.occurredOn,
        notes: values.notes.trim(),
      };
      for (const field of DETAIL_FIELDS) {
        const value = values[field].trim();
        if (value) {
          input[field] = value;
        }
      }
      if (values.downtimeMinutes) {
        input.downtimeMinutes = Number(values.downtimeMinutes);
      }
      try {
        await onSave(input);
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

  const errorProps = (field: FieldName) =>
    fieldErrors[field]
      ? { "aria-describedby": `${id}-${field}-error`, "aria-invalid": true }
      : {};
  const errorText = (field: FieldName) =>
    fieldErrors[field] ? (
      <FieldError id={`${id}-${field}-error`}>{fieldErrors[field]}</FieldError>
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
          <FieldSet disabled={pending}>
            <FieldLegend className="sr-only">Asset event</FieldLegend>
            <Field>
              <FieldLabel htmlFor={`${id}-type`}>Type</FieldLabel>
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
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-occurred-on`}>Event date</FieldLabel>
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
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-notes`}>Notes</FieldLabel>
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
            </Field>
          </FieldSet>
          <FieldSet disabled={pending}>
            <FieldLegend>Maintenance details</FieldLegend>
            <FieldDescription>
              Optional. Leave blank if not known.
            </FieldDescription>
            <Field>
              <FieldLabel htmlFor={`${id}-findings`}>Findings</FieldLabel>
              <Textarea
                id={`${id}-findings`}
                maxLength={2500}
                name="findings"
                onChange={handleChange}
                value={values.findings}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-work-performed`}>
                Work performed
              </FieldLabel>
              <Textarea
                id={`${id}-work-performed`}
                maxLength={2500}
                name="workPerformed"
                onChange={handleChange}
                value={values.workPerformed}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-service-provider`}>
                Service provider
              </FieldLabel>
              <Input
                id={`${id}-service-provider`}
                maxLength={200}
                name="serviceProvider"
                onChange={handleChange}
                value={values.serviceProvider}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-parts-replaced`}>
                Parts replaced
              </FieldLabel>
              <Textarea
                id={`${id}-parts-replaced`}
                maxLength={2500}
                name="partsReplaced"
                onChange={handleChange}
                value={values.partsReplaced}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-downtime`}>
                Downtime (minutes)
              </FieldLabel>
              <Input
                {...errorProps("downtimeMinutes")}
                id={`${id}-downtime`}
                inputMode="numeric"
                min={0}
                name="downtimeMinutes"
                onChange={handleChange}
                step={1}
                type="number"
                value={values.downtimeMinutes}
              />
              {errorText("downtimeMinutes")}
            </Field>
          </FieldSet>
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
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : "Record event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
