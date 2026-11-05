import { Badge } from "@proj/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { Cpu } from "lucide-react";
import { useCallback, useMemo } from "react";
import { DeviceStatusBadge } from "@/components/device-status-badge";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { ListPageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { type EstateDevice, useEstateDevices } from "@/lib/devices";
import { flattenLocations, useLocations } from "@/lib/locations";

export function EstateDevicesPage({ estateId }: { estateId: string }) {
  const devices = useEstateDevices(estateId);
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
  const retry = useCallback(() => devices.refetch(), [devices.refetch]);
  return (
    <PageLayout className="min-w-0">
      <ListPageHeader
        description="Reporting status, quiet devices first"
        icon={Cpu}
        title="Devices"
      />
      <p className="text-muted-foreground my-4 text-sm">
        Refreshes every 60 seconds while this page is open.
      </p>
      {devices.isPending ? (
        <LoadingState label="Loading devices…" variant="table" />
      ) : null}
      {devices.error ? (
        <ErrorState message={devices.error.message} onRetry={retry} />
      ) : null}
      {devices.data?.length === 0 ? (
        <EmptyState
          description="Register devices from an asset's Devices page"
          title="No devices yet"
        />
      ) : null}
      {devices.data?.length ? (
        <Table
          aria-label="Devices"
          className="[&_td]:align-top [&_td]:whitespace-normal"
        >
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.data.map((device) => (
              <DeviceRow
                device={device}
                key={device.id}
                location={paths.get(device.locationId)}
              />
            ))}
          </TableBody>
        </Table>
      ) : null}
    </PageLayout>
  );
}

function DeviceRow({
  device,
  location,
}: {
  device: EstateDevice;
  location: string | undefined;
}) {
  return (
    <TableRow>
      <TableCell className="max-w-56 py-4">
        <p className="font-medium wrap-anywhere">{device.identifier}</p>
        <p className="text-muted-foreground text-sm wrap-anywhere">
          {device.model}
        </p>
      </TableCell>
      <TableCell className="max-w-56 py-4">
        <Link
          className="font-medium wrap-anywhere underline-offset-4 hover:underline"
          params={{ estateId: device.estateId, assetId: device.assetId }}
          to="/estates/$estateId/assets/$assetId"
        >
          {device.assetName}
        </Link>
        <p className="text-muted-foreground text-sm">{device.assetReference}</p>
        {device.assetRetired ? (
          <Badge className="mt-1" variant="secondary">
            Retired
          </Badge>
        ) : null}
      </TableCell>
      <TableCell className="py-4">
        {location ?? "Location unavailable"}
      </TableCell>
      <TableCell className="py-4">
        {device.lastSeenAt ? (
          <time dateTime={device.lastSeenAt}>
            {new Date(device.lastSeenAt).toLocaleString()}
          </time>
        ) : (
          "Never"
        )}
      </TableCell>
      <TableCell className="py-4">
        <DeviceStatusBadge status={device.status} />
      </TableCell>
    </TableRow>
  );
}
