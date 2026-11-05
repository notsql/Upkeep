import { Field, FieldLabel } from "@proj/ui/components/field";
import { Textarea } from "@proj/ui/components/textarea";
import type { ChangeEvent } from "react";
import type { WorkOrderInput } from "@/lib/work-orders";

export function SourceReferenceField({
  source,
  value,
  onChange,
}: {
  source: WorkOrderInput["source"];
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  if (source !== "INSPECTION" && source !== "MAINTENANCE_RECOMMENDATION") {
    return null;
  }
  return (
    <Field>
      <FieldLabel htmlFor="work-source-reference">
        Source reference or explanation
      </FieldLabel>
      <Textarea
        id="work-source-reference"
        maxLength={500}
        onChange={onChange}
        required
        value={value}
      />
    </Field>
  );
}
