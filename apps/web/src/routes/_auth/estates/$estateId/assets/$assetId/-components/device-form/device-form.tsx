import { Button } from "@proj/ui/components/button";
import type { DeviceInput } from "@/lib/devices";
import { DeviceFormIdentityFields } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/device-form-identity-fields";
import { DeviceFormLocationField } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/device-form-location-field";
import { DeviceFormMetricsFields } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/device-form-metrics-fields";
import { DeviceFormReportingField } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/device-form-reporting-field";
import {
  type InitialDevice,
  useDeviceForm,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/use-device-form";

export function DeviceForm({
  defaultLocationId,
  estateId,
  initialDevice,
  onSave,
  onCancel,
  submitLabel = "Register device",
  pendingLabel = "Registering…",
}: {
  defaultLocationId: string;
  estateId: string;
  initialDevice?: InitialDevice;
  onSave: (values: DeviceInput) => Promise<unknown>;
  onCancel?: () => void;
  submitLabel?: string;
  pendingLabel?: string;
}) {
  const {
    error,
    errorProps,
    fieldErrors,
    handleChange,
    handleLocationChange,
    handleMetricChange,
    handleSubmit,
    id,
    locationItems,
    locationsError,
    metrics,
    pending,
    values,
  } = useDeviceForm({ defaultLocationId, estateId, initialDevice, onSave });
  const fieldProps = { errorProps, fieldErrors, id, pending };

  const buttonLabel = pending ? pendingLabel : submitLabel;
  return (
    <form className="mt-4 grid gap-5" noValidate onSubmit={handleSubmit}>
      <DeviceFormIdentityFields
        {...fieldProps}
        handleChange={handleChange}
        values={values}
      />
      <DeviceFormLocationField
        {...fieldProps}
        handleLocationChange={handleLocationChange}
        locationId={values.locationId}
        locationItems={locationItems}
        locationsError={locationsError}
      />
      <DeviceFormMetricsFields
        {...fieldProps}
        handleMetricChange={handleMetricChange}
        metrics={metrics}
      />
      <DeviceFormReportingField
        {...fieldProps}
        handleChange={handleChange}
        interval={values.interval}
      />
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button
            disabled={pending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        ) : null}
        <Button disabled={pending} type="submit">
          {buttonLabel}
        </Button>
      </div>
    </form>
  );
}
