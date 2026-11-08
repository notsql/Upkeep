import { Field, FieldDescription, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import { Textarea } from "@proj/ui/components/textarea";
import type { ChangeEvent } from "react";

export function ReportDetailsFields({
  id,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
}: {
  id: string;
  title: string;
  description: string;
  onTitleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDescriptionChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
        <Input
          aria-describedby={`${id}-title-help`}
          id={`${id}-title`}
          maxLength={50}
          onChange={onTitleChange}
          value={title}
        />
        <FieldDescription id={`${id}-title-help`}>
          Give the fault a short title in up to 50 characters.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
        <Textarea
          id={`${id}-description`}
          maxLength={2500}
          onChange={onDescriptionChange}
          value={description}
        />
        <FieldDescription>
          Describe the fault in up to 2,500 characters.
        </FieldDescription>
      </Field>
    </>
  );
}
