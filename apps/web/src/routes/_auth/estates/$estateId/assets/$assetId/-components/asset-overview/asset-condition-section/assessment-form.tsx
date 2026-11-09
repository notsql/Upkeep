import { Button } from "@proj/ui/components/button";
import type { AssessmentInput } from "@/lib/assessments";
import { AssessmentFormFields } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/assessment-form-fields";
import { useAssessmentForm } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/use-assessment-form";

export function AssessmentForm({
  onSave,
  onCancel,
}: {
  onSave: (values: AssessmentInput) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const {
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
  } = useAssessmentForm(onSave);

  return (
    <form className="mt-4 grid gap-5" noValidate onSubmit={handleSubmit}>
      <AssessmentFormFields
        errorProps={errorProps}
        fieldErrors={fieldErrors}
        handleAssessedOnChange={handleAssessedOnChange}
        handleChange={handleChange}
        handleConditionChange={handleConditionChange}
        id={id}
        pending={pending}
        today={today}
        values={values}
      />
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button
            disabled={pending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        ) : null}
        <Button disabled={pending} type="submit">
          {pending ? "Recording…" : "Record condition check"}
        </Button>
      </div>
    </form>
  );
}
