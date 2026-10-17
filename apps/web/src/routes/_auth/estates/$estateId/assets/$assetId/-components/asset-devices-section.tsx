import { Badge } from "@proj/ui/components/badge";
import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  type Device,
  deviceMetrics,
  formatInterval,
  useDevices,
} from "@/lib/devices";
import { flattenLocations, useLocations } from "@/lib/locations";
import { DeviceCredential } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-credential";

function metricSummary(device: Device): string {
  return device.metrics
    .map(({ metric, unit }) => `${deviceMetrics[metric].name} (${unit})`)
    .join(", ");
}

export function AssetDevicesSection({
  assetId,
  canRegister,
  estateId,
}: {
  assetId: string;
  canRegister: boolean;
  estateId: string;
}) {
  const devices = useDevices(estateId, assetId);
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
  return (
    <section aria-labelledby="devices-heading" className="section-surface mt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-semibold text-xl" id="devices-heading">
          Devices
        </h2>
        {canRegister ? (
          <Link
            className={buttonVariants({ variant: "outline" })}
            params={{ estateId, assetId }}
            to="/estates/$estateId/assets/$assetId/devices/new"
          >
            Register device
          </Link>
        ) : null}
      </div>
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
      <ul aria-label="Devices" className="mt-4 grid gap-3">
        {devices.data?.map((device) => (
          <li className="rounded-lg border p-4" key={device.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="break-all font-medium">{device.identifier}</h3>
              <Badge className="whitespace-normal" variant="outline">
                {device.lastSeenAt
                  ? `Last seen ${new Date(device.lastSeenAt).toLocaleString()}`
                  : "Awaiting first reading"}
              </Badge>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Model</dt>
                <dd className="break-words">{device.model}</dd>
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
            <DeviceCredential
              assetId={assetId}
              canManage={canRegister}
              device={device}
              estateId={estateId}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
