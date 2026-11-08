import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { FieldSeparator } from "@proj/ui/components/field";
import { FormActions } from "@/components/forms/form-actions";
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
    <form className="grid gap-5" noValidate onSubmit={handleSubmit}>
      <DeviceFormIdentityFields
        {...fieldProps}
        handleChange={handleChange}
        values={values}
      />
      <FieldSeparator />
      <DeviceFormLocationField
        {...fieldProps}
        handleLocationChange={handleLocationChange}
        locationId={values.locationId}
        locationItems={locationItems}
        locationsError={locationsError}
      />
      <FieldSeparator />
      <DeviceFormMetricsFields
        {...fieldProps}
        handleMetricChange={handleMetricChange}
        metrics={metrics}
      />
      <FieldSeparator />
      <DeviceFormReportingField
        {...fieldProps}
        handleChange={handleChange}
        interval={values.interval}
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <FormActions label={buttonLabel} onCancel={onCancel} pending={pending} />
    </form>
  );
}
