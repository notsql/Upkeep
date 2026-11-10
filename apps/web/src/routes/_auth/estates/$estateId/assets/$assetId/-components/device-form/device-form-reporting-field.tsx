import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import type { ChangeEvent } from "react";
import { MAX_REPORTING_INTERVAL_SECONDS } from "@/lib/devices";
import { DeviceFormFieldError } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/device-form-field-error";
import type {
  DeviceFieldErrors,
  useDeviceForm,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/use-device-form";

export function DeviceFormReportingField({
  errorProps,
  fieldErrors,
  handleChange,
  id,
  interval,
  pending,
}: {
  errorProps: ReturnType<typeof useDeviceForm>["errorProps"];
  fieldErrors: DeviceFieldErrors;
  id: string;
  pending: boolean;
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  interval: string;
}) {
  return (
    <FieldSet disabled={pending}>
      <FieldLegend>Reporting</FieldLegend>
      <Field>
        <FieldLabel htmlFor={`${id}-interval`}>
          How often it reports (seconds)
        </FieldLabel>
        <Input
          {...errorProps("interval")}
          id={`${id}-interval`}
          max={MAX_REPORTING_INTERVAL_SECONDS}
          min={1}
          name="interval"
          onChange={handleChange}
          required
          step={1}
          type="number"
          value={interval}
        />
        <DeviceFormFieldError
          field="interval"
          fieldErrors={fieldErrors}
          id={id}
        />
      </Field>
    </FieldSet>
  );
}
