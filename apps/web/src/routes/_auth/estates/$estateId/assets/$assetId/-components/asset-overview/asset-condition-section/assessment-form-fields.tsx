import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { Textarea } from "@proj/ui/components/textarea";
import type { ChangeEvent } from "react";
import { DatePicker } from "@/components/forms/date-picker";
import { conditionLabel } from "@/lib/assessments";
import type {
  AssessmentFieldErrors,
  AssessmentFormField,
  AssessmentFormValues,
  useAssessmentForm,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/use-assessment-form";

const conditionItems = [
  { value: "", label: "Select a condition" },
  ...Object.entries(conditionLabel).map(([value, label]) => ({
    value,
    label,
  })),
];

export function AssessmentFormFields({
  errorProps,
  fieldErrors,
  handleAssessedOnChange,
  handleChange,
  handleConditionChange,
  id,
  pending,
  today,
  values,
}: {
  errorProps: ReturnType<typeof useAssessmentForm>["errorProps"];
  fieldErrors: AssessmentFieldErrors;
  handleAssessedOnChange: (value: string) => void;
  handleChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  handleConditionChange: (value: string | null) => void;
  id: string;
  pending: boolean;
  today: string;
  values: AssessmentFormValues;
}) {
  const errorText = (field: AssessmentFormField) =>
    fieldErrors[field] ? (
      <p className="text-destructive text-sm" id={`${id}-${field}-error`}>
        {fieldErrors[field]}
      </p>
    ) : null;

  return (
    <fieldset className="grid gap-5" disabled={pending}>
      <legend className="sr-only">Condition check</legend>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-condition`}>Condition</Label>
        <Select
          items={conditionItems}
          onValueChange={handleConditionChange}
          required
          value={values.condition}
        >
          <SelectTrigger
            {...errorProps("condition")}
            className="w-full"
            id={`${id}-condition`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {conditionItems.slice(1).map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errorText("condition")}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-assessed-on`}>Date checked</Label>
        <DatePicker
          {...errorProps("assessedOn")}
          clearable={false}
          id={`${id}-assessed-on`}
          max={today}
          onChange={handleAssessedOnChange}
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
  );
}
