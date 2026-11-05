import { Card, CardContent } from "@proj/ui/components/card";
import type { Device, DeviceInput } from "@/lib/devices";
import { DeviceForm } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form";

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
    <Card>
      <CardContent>
        <div>
          <p className="mb-4 text-sm">
            {device.identifier} will be deactivated and its key will stop
            working. The new device needs its own identifier and credential.
          </p>
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
            submitLabel="Replace device"
          />
        </div>
      </CardContent>
    </Card>
  );
}
