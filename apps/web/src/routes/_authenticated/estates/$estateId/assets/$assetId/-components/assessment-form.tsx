import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@proj/ui/components/native-select";
import { Textarea } from "@proj/ui/components/textarea";
import {
  type ChangeEvent,
  type SubmitEvent,
  useCallback,
  useId,
  useState,
} from "react";
import {
  type AssessmentInput,
  type AssetCondition,
  conditionLabel,
  localToday,
} from "@/lib/assessments";

interface FormValues {
  assessedOn: string;
  condition: string;
  notes: string;
}

type Field = keyof FormValues;
type FieldErrors = Partial<Record<Field, string>>;

function isCondition(value: string): value is AssetCondition {
  return value in conditionLabel;
}

function validate(values: FormValues, today: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!isCondition(values.condition)) {
    errors.condition = "Condition is required.";
  }
  if (!values.assessedOn) {
    errors.assessedOn = "Assessment date is required.";
  } else if (values.assessedOn > today) {
    // ISO dates compare correctly as strings.
    errors.assessedOn = "The assessment date cannot be in the future.";
  }
  if (!values.notes.trim()) {
    errors.notes = "Notes are required.";
  }
  return errors;
}

export function AssessmentForm({
  onSave,
}: {
  onSave: (values: AssessmentInput) => Promise<unknown>;
}) {
  const id = useId();
  const [today] = useState(localToday);
  const [values, setValues] = useState<FormValues>({
    condition: "",
    assessedOn: today,
    notes: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const handleChange = useCallback(
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      const { name, value } = event.target;
      setValues((current) => ({ ...current, [name]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) {
        return;
      }
      const errors = validate(values, today);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0 || !isCondition(values.condition)) {
        return;
      }
      setPending(true);
      setError(undefined);
      try {
        await onSave({
          condition: values.condition,
          assessedOn: values.assessedOn,
          notes: values.notes.trim(),
        });
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to record the assessment. Please try again."
        );
      } finally {
        setPending(false);
      }
    },
    [onSave, pending, today, values]
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
    <form className="mt-4 grid gap-5" noValidate onSubmit={handleSubmit}>
      <fieldset className="grid gap-5" disabled={pending}>
        <legend className="sr-only">Condition assessment</legend>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-condition`}>Condition</Label>
          <NativeSelect
            {...errorProps("condition")}
            className="w-full"
            id={`${id}-condition`}
            name="condition"
            onChange={handleChange}
            required
            value={values.condition}
          >
            <NativeSelectOption value="">Select a condition</NativeSelectOption>
            {Object.entries(conditionLabel).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errorText("condition")}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-assessed-on`}>Assessment date</Label>
          <Input
            {...errorProps("assessedOn")}
            id={`${id}-assessed-on`}
            max={today}
            name="assessedOn"
            onChange={handleChange}
            required
            type="date"
            value={values.assessedOn}
          />
          {errorText("assessedOn")}
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
      <div>
        <Button disabled={pending} type="submit">
          {pending ? "Recording…" : "Record assessment"}
        </Button>
      </div>
    </form>
  );
}
