import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { FormCard } from "@/components/page/form-page";
import type { Device, DeviceInput } from "@/lib/devices";
import { DeviceForm } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form/device-form";

export function ReplaceDeviceFormCard({
  device,
  estateId,
  onCancel,
  onSave,
}: {
  device: Device;
  estateId: string;
  onCancel: () => void;
  onSave: (values: DeviceInput) => Promise<void>;
}) {
  return (
    <FormCard>
      <div className="grid gap-5">
        <Alert>
          <AlertDescription>
            {device.identifier} will be turned off and its key will stop
            working. The new sensor needs its own name and connection key.
          </AlertDescription>
        </Alert>
        <DeviceForm
          defaultLocationId={device.locationId}
          estateId={estateId}
          initialDevice={{
            model: device.model,
            locationId: device.locationId,
            metrics: device.metrics.map(({ metric }) => metric),
            reportingIntervalSeconds: device.reportingIntervalSeconds,
          }}
          onCancel={onCancel}
          onSave={onSave}
          pendingLabel="Replacing…"
          submitLabel="Replace sensor"
        />
      </div>
    </FormCard>
  );
}
