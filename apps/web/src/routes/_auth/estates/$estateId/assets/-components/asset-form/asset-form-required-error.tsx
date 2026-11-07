import { FieldError } from "@proj/ui/components/field";
import type {
  FieldErrors,
  RequiredField,
} from "@/routes/_auth/estates/$estateId/assets/-components/asset-form/use-asset-form";

export function AssetFormRequiredError({
  field,
  fieldErrors,
  id,
}: {
  field: RequiredField;
  fieldErrors: FieldErrors;
  id: string;
}) {
  return fieldErrors[field] ? (
    <FieldError id={`${id}-${field}-error`}>{fieldErrors[field]}</FieldError>
  ) : null;
}
