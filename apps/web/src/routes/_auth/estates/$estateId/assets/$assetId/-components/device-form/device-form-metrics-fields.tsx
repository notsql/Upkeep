import type { DeviceMetric } from "@/lib/devices";
import { DeviceFormFieldError } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/device-form-field-error";
import { MetricOption } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/metric-option";
import {
  catalogue,
  type DeviceFieldErrors,
  type useDeviceForm,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/use-device-form";

export function DeviceFormMetricsFields({
  errorProps,
  fieldErrors,
  handleMetricChange,
  id,
  metrics,
  pending,
}: {
  errorProps: ReturnType<typeof useDeviceForm>["errorProps"];
  fieldErrors: DeviceFieldErrors;
  id: string;
  pending: boolean;
  handleMetricChange: (metric: DeviceMetric, checked: boolean) => void;
  metrics: Set<DeviceMetric>;
}) {
  return (
    <fieldset
      disabled={pending}
      {...errorProps("metrics")}
      className="grid gap-2 sm:grid-cols-2"
    >
      <legend className="mb-2 text-sm font-medium">Supported metrics</legend>
      {catalogue.map(([metric, { name, unit }]) => (
        <MetricOption
          checked={metrics.has(metric)}
          // A fieldset does not disable the non-native checkbox.
          disabled={pending}
          id={`${id}-metric-${metric}`}
          key={metric}
          label={`${name} (${unit})`}
          metric={metric}
          onChange={handleMetricChange}
        />
      ))}
      <DeviceFormFieldError field="metrics" fieldErrors={fieldErrors} id={id} />
    </fieldset>
  );
}
