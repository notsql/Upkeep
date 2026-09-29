import { Button } from "@proj/ui/components/button";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type Device,
  type DeviceInput,
  deviceMetrics,
  formatInterval,
  useDevices,
  useRegisterDevice,
} from "@/lib/devices";
import { flattenLocations, useLocations } from "@/lib/locations";
import { DeviceForm } from "@/routes/_authenticated/estates/$estateId/assets/$assetId/-components/device-form";

function metricSummary(device: Device): string {
  return device.metrics
    .map(({ metric, unit }) => `${deviceMetrics[metric].name} (${unit})`)
    .join(", ");
}

export function AssetDevicesSection({
  assetId,
  assetLocationId,
  canRegister,
  estateId,
}: {
  assetId: string;
  assetLocationId: string;
  canRegister: boolean;
  estateId: string;
}) {
  const devices = useDevices(estateId, assetId);
  const register = useRegisterDevice(estateId, assetId);
  const locations = useLocations(estateId);
  const paths = useMemo(
    () =>
      new Map(
        flattenLocations(locations.data ?? []).map((node) => [
          node.id,
          node.path.join(" › "),
        ])
      ),
    [locations.data]
  );
  const [registering, setRegistering] = useState(false);
  const openForm = useCallback(() => setRegistering(true), []);
  const save = useCallback(
    async (values: DeviceInput) => {
      await register.mutateAsync(values);
      setRegistering(false);
      toast.success("Device registered. It is awaiting its first reading.");
    },
    [register.mutateAsync]
  );

  return (
    <section aria-labelledby="devices-heading" className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-xl" id="devices-heading">
          Devices
        </h2>
        {canRegister && !registering ? (
          <Button onClick={openForm} variant="outline">
            Register device
          </Button>
        ) : null}
      </div>
      {registering ? (
        <DeviceForm
          defaultLocationId={assetLocationId}
          estateId={estateId}
          onSave={save}
        />
      ) : null}
      {devices.isPending ? (
        <p aria-live="polite" className="mt-4">
          Loading devices…
        </p>
      ) : null}
      {devices.error ? (
        <p className="mt-4 text-destructive" role="alert">
          {devices.error.message}
        </p>
      ) : null}
      {devices.data?.length === 0 ? (
        <p className="mt-4 text-muted-foreground">
          No devices are registered to this asset yet.
        </p>
      ) : null}
      <ul className="mt-4 grid gap-4">
        {devices.data?.map((device) => (
          <li className="border p-4" key={device.id}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">{device.identifier}</h3>
              <span className="border px-2 py-1 text-xs">
                {device.lastSeenAt
                  ? `Last seen ${new Date(device.lastSeenAt).toLocaleString()}`
                  : "Awaiting first reading"}
              </span>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Model</dt>
                <dd>{device.model}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Location</dt>
                <dd>
                  {paths.get(device.locationId) ?? "Location unavailable"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Metrics</dt>
                <dd>{metricSummary(device)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reporting</dt>
                <dd>{formatInterval(device.reportingIntervalSeconds)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
