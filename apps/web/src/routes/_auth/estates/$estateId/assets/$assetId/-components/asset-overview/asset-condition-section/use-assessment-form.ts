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

export interface AssessmentFormValues {
  assessedOn: string;
  condition: string;
  notes: string;
}

export type AssessmentFormField = keyof AssessmentFormValues;

export type AssessmentFieldErrors = Partial<
  Record<AssessmentFormField, string>
>;

function isCondition(value: string): value is AssetCondition {
  return value in conditionLabel;
}

function validate(
  values: AssessmentFormValues,
  today: string
): AssessmentFieldErrors {
  const errors: AssessmentFieldErrors = {};
  if (!isCondition(values.condition)) {
    errors.condition = "Condition is required.";
  }
  if (!values.assessedOn) {
    errors.assessedOn = "The date checked is required.";
  } else if (values.assessedOn > today) {
    // ISO dates compare correctly as strings.
    errors.assessedOn = "The date can't be in the future.";
  }
  if (!values.notes.trim()) {
    errors.notes = "Notes are required.";
  }
  return errors;
}
export function useAssessmentForm(
  onSave: (values: AssessmentInput) => Promise<unknown>
) {
  const id = useId();
  const [today] = useState(localToday);
  const [values, setValues] = useState<AssessmentFormValues>({
    condition: "",
    assessedOn: today,
    notes: "",
  });
  const [fieldErrors, setFieldErrors] = useState<AssessmentFieldErrors>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target;
      setValues((current) => ({ ...current, [name]: value }));
    },
    []
  );

  const handleAssessedOnChange = useCallback((value: string) => {
    setValues((current) => ({ ...current, assessedOn: value }));
  }, []);

  const handleConditionChange = useCallback((value: string | null) => {
    setValues((current) => ({ ...current, condition: value ?? "" }));
  }, []);

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
            : "Couldn't record the condition check. Try again."
        );
      } finally {
        setPending(false);
      }
    },
    [onSave, pending, today, values]
  );

  const errorProps = (field: AssessmentFormField) =>
    fieldErrors[field]
      ? { "aria-describedby": `${id}-${field}-error`, "aria-invalid": true }
      : {};

  return {
    error,
    errorProps,
    fieldErrors,
    handleAssessedOnChange,
    handleChange,
    handleConditionChange,
    handleSubmit,
    id,
    pending,
    today,
    values,
  };
}
