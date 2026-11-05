import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import type { ChangeEvent } from "react";
import { DeviceFormFieldError } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form-field-error";
import type {
  DeviceFieldErrors,
  useDeviceForm,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/use-device-form";

export function DeviceFormIdentityFields({
  errorProps,
  fieldErrors,
  handleChange,
  id,
  pending,
  values,
}: {
  errorProps: ReturnType<typeof useDeviceForm>["errorProps"];
  fieldErrors: DeviceFieldErrors;
  id: string;
  pending: boolean;
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  values: { identifier: string; model: string };
}) {
  return (
    <fieldset className="grid gap-5" disabled={pending}>
      <legend className="mb-3 font-semibold">Device identity</legend>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-identifier`}>Identifier</Label>
        <Input
          {...errorProps("identifier")}
          id={`${id}-identifier`}
          maxLength={100}
          name="identifier"
          onChange={handleChange}
          required
          value={values.identifier}
        />
        <DeviceFormFieldError
          field="identifier"
          fieldErrors={fieldErrors}
          id={id}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-model`}>Model</Label>
        <Input
          {...errorProps("model")}
          id={`${id}-model`}
          maxLength={200}
          name="model"
          onChange={handleChange}
          required
          value={values.model}
        />
        <DeviceFormFieldError field="model" fieldErrors={fieldErrors} id={id} />
      </div>
    </fieldset>
  );
}
