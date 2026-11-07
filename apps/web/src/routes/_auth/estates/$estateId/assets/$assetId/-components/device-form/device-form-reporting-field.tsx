import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
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
    <fieldset className="grid gap-3" disabled={pending}>
      <legend className="mb-3 font-semibold">Reporting</legend>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-interval`}>
          Expected reporting interval (seconds)
        </Label>
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
      </div>
    </fieldset>
  );
}
