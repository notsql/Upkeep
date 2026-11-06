import type {
  DeviceFieldErrors,
  DeviceFormField,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/use-device-form";

export function DeviceFormFieldError({
  field,
  fieldErrors,
  id,
}: {
  field: DeviceFormField;
  fieldErrors: DeviceFieldErrors;
  id: string;
}) {
  return fieldErrors[field] ? (
    <p className="text-destructive text-sm" id={`${id}-${field}-error`}>
      {fieldErrors[field]}
    </p>
  ) : null;
}
