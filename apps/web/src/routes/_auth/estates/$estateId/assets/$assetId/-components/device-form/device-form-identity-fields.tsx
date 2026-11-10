import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import type { ChangeEvent } from "react";
import { DeviceFormFieldError } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/device-form-field-error";
import type {
  DeviceFieldErrors,
  useDeviceForm,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/use-device-form";

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
    <FieldSet disabled={pending}>
      <FieldLegend>Sensor details</FieldLegend>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-identifier`}>Identifier</FieldLabel>
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
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-model`}>Model</FieldLabel>
          <Input
            {...errorProps("model")}
            id={`${id}-model`}
            maxLength={200}
            name="model"
            onChange={handleChange}
            required
            value={values.model}
          />
          <DeviceFormFieldError
            field="model"
            fieldErrors={fieldErrors}
            id={id}
          />
        </Field>
      </div>
    </FieldSet>
  );
}
