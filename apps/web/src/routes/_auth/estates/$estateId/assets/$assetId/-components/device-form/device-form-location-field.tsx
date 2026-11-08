import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@proj/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { DeviceFormFieldError } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/device-form-field-error";
import type {
  DeviceFieldErrors,
  useDeviceForm,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/use-device-form";

export function DeviceFormLocationField({
  errorProps,
  fieldErrors,
  handleLocationChange,
  id,
  locationId,
  locationItems,
  locationsError,
  pending,
}: {
  errorProps: ReturnType<typeof useDeviceForm>["errorProps"];
  fieldErrors: DeviceFieldErrors;
  id: string;
  pending: boolean;
  handleLocationChange: (value: string | null) => void;
  locationId: string;
  locationItems: { label: string; value: string }[];
  locationsError: Error | null;
}) {
  return (
    <FieldSet disabled={pending}>
      <FieldLegend>Location</FieldLegend>
      <Field>
        <FieldLabel htmlFor={`${id}-location`}>Location</FieldLabel>
        <Select
          items={locationItems}
          onValueChange={handleLocationChange}
          required
          value={locationId}
        >
          <SelectTrigger
            {...errorProps("locationId")}
            className="w-full"
            id={`${id}-location`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locationItems.slice(1).map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DeviceFormFieldError
          field="locationId"
          fieldErrors={fieldErrors}
          id={id}
        />
        {locationsError ? (
          <p className="text-destructive text-sm" role="alert">
            {locationsError.message}
          </p>
        ) : null}
      </Field>
    </FieldSet>
  );
}
