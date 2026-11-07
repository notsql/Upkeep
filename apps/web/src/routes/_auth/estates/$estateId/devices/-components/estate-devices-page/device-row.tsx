import { Badge } from "@proj/ui/components/badge";
import { TableCell, TableRow } from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { DeviceStatusBadge } from "@/components/badges/device-status-badge";
import type { EstateDevice } from "@/lib/devices";

export function DeviceRow({
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
