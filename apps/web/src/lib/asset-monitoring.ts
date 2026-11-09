import type { Asset } from "@/lib/assets";
import type { DeviceStatus, EstateDevice } from "@/lib/devices";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";
import { flattenLocations, type Location } from "@/lib/locations";
import { deviceStatusTone, type StatusTone } from "@/lib/status-tone";

export interface AssetLevelGroup {
  assets: Asset[];
  id: string;
  /** Null for the unknown-location group, which has no level subheading. */
  name: string | null;
}

export interface AssetBlockGroup {
  id: string;
  levels: AssetLevelGroup[];
  name: string;
}

const UNKNOWN = "unknown";

/**
 * Groups assets by block, then level, in location-tree order. Assets located
 * directly on a block form a "Block-wide" group first; unresolvable locations
 * go last under "Unknown location". Assets keep their input order inside a
 * group, so the caller's sort applies there.
 */
export function groupAssetsByLocation(
  assets: readonly Asset[],
  locations: Location[]
): AssetBlockGroup[] {
  const nodes = flattenLocations(locations);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const position = new Map(nodes.map((node, index) => [node.id, index]));
  const blocks = new Map<string, AssetBlockGroup>();
  const unknown: Asset[] = [];
  for (const asset of assets) {
    const node = byId.get(asset.locationId);
    if (!node) {
      unknown.push(asset);
      continue;
    }
    const [blockName, levelName] = node.path;
    const blockId = ancestorId(node.id, byId, 0);
    const levelId = node.path.length > 1 ? ancestorId(node.id, byId, 1) : "";
    let block = blocks.get(blockId);
    if (!block) {
      block = { id: blockId, name: blockName, levels: [] };
      blocks.set(blockId, block);
    }
    const groupId = levelId || `${blockId}-block-wide`;
    let level = block.levels.find((item) => item.id === groupId);
    if (!level) {
      level = {
        id: groupId,
        name: levelId ? levelName : "Block-wide",
        assets: [],
      };
      block.levels.push(level);
    }
    level.assets.push(asset);
  }
  const rank = (id: string) => position.get(id) ?? -1;
  const groups = [...blocks.values()].sort((a, b) => rank(a.id) - rank(b.id));
  for (const block of groups) {
    block.levels.sort((a, b) => rank(a.id) - rank(b.id));
  }
  if (unknown.length > 0) {
    groups.push({
      id: UNKNOWN,
      name: "Unknown location",
      levels: [{ id: UNKNOWN, name: null, assets: unknown }],
    });
  }
  return groups;
}

/** The ID of the node's ancestor at `depth` (0 = block). */
function ancestorId(
  id: string,
  byId: Map<string, Location>,
  depth: number
): string {
  const chain: string[] = [];
  let current = byId.get(id);
  while (current) {
    chain.unshift(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain[depth] ?? id;
}

/**
 * Per-asset device summary: "No devices", "2 devices online" or
 * "1 of 2 offline". Offline and awaiting count as not online; deactivated
 * devices are left out.
 */
export function deviceSummaries(
  devices: readonly EstateDevice[]
): (assetId: string) => string {
  const counts = deviceCounts(devices);
  return (assetId) => {
    const count = counts.get(assetId);
    if (!count) {
      return "No devices";
    }
    if (count.online === count.total) {
      return `${count.total} ${count.total === 1 ? "device" : "devices"} online`;
    }
    return `${count.total - count.online} of ${count.total} offline`;
  };
}

/**
 * The tone for each asset's device summary: success when all are online,
 * the offline device tone when any is not, muted with no devices.
 */
export function deviceSummaryTones(
  devices: readonly EstateDevice[]
): (assetId: string) => StatusTone {
  const counts = deviceCounts(devices);
  return (assetId) => {
    const count = counts.get(assetId);
    if (!count) {
      return "muted";
    }
    return count.online === count.total
      ? deviceStatusTone.ONLINE
      : deviceStatusTone.OFFLINE;
  };
}

function deviceCounts(
  devices: readonly EstateDevice[]
): Map<string, { total: number; online: number }> {
  const counts = new Map<string, { total: number; online: number }>();
  for (const device of devices) {
    if (device.status === "DEACTIVATED") {
      continue;
    }
    const count = counts.get(device.assetId) ?? { total: 0, online: 0 };
    count.total += 1;
    if (device.status === "ONLINE") {
      count.online += 1;
    }
    counts.set(device.assetId, count);
  }
  return counts;
}

/** One row of Assets > All devices. */
export interface RankedDevice {
  assetId: string;
  assetName: string;
  assetReference: string;
  assetRetired: boolean;
  deviceId: string;
  /** Any metric is in Possible flatline. */
  flatlined: boolean;
  identifier: string;
  lastSeenAt: string | null;
  /** The device's own location: an ID from the device list, a path from the review. */
  locationId: string | null;
  locationPath: string | null;
  model: string | null;
  sensors: MonitoredSensor[];
  /** Null when the row comes from the flatline review alone (Council). */
  status: DeviceStatus | null;
}

const STATUS_RANK: Record<DeviceStatus, number> = {
  OFFLINE: 1,
  AWAITING_FIRST_READING: 2,
  ONLINE: 3,
  DEACTIVATED: 4,
};

function severity(row: RankedDevice): number {
  if (row.status === "DEACTIVATED") {
    return STATUS_RANK.DEACTIVATED;
  }
  if (row.flatlined) {
    return 0;
  }
  return row.status ? STATUS_RANK[row.status] : STATUS_RANK.ONLINE;
}

/**
 * Every device, worst first: Possible flatline, Offline, Awaiting first
 * reading, Online, Deactivated; ties by asset name, then identifier. Paused
 * metrics do not raise a device. Without a device list (`null`) the rows are
 * built from the review entries alone.
 */
export function rankDevices(
  devices: readonly EstateDevice[] | null,
  sensors: readonly MonitoredSensor[]
): RankedDevice[] {
  const byDevice = new Map<string, MonitoredSensor[]>();
  for (const sensor of sensors) {
    byDevice.set(sensor.deviceId, [
      ...(byDevice.get(sensor.deviceId) ?? []),
      sensor,
    ]);
  }
  const rows: RankedDevice[] = devices
    ? devices.map((device) =>
        toRow(device.id, byDevice.get(device.id) ?? [], {
          assetId: device.assetId,
          assetName: device.assetName,
          assetReference: device.assetReference,
          assetRetired: device.assetRetired,
          identifier: device.identifier,
          lastSeenAt: device.lastSeenAt ?? null,
          locationId: device.locationId,
          locationPath: null,
          model: device.model,
          status: device.status,
        })
      )
    : [...byDevice].map(([deviceId, entries]) => {
        const [first] = entries as [MonitoredSensor];
        return toRow(deviceId, entries, {
          assetId: first.assetId,
          assetName: first.assetName,
          assetReference: first.assetReference,
          assetRetired: false,
          identifier: first.deviceIdentifier,
          lastSeenAt: null,
          locationId: null,
          locationPath: first.deviceLocationPath,
          model: null,
          status: null,
        });
      });
  return rows.sort(
    (a, b) =>
      severity(a) - severity(b) ||
      a.assetName.localeCompare(b.assetName) ||
      a.identifier.localeCompare(b.identifier)
  );
}

function toRow(
  deviceId: string,
  sensors: MonitoredSensor[],
  fields: Omit<RankedDevice, "deviceId" | "flatlined" | "sensors">
): RankedDevice {
  return {
    ...fields,
    deviceId,
    sensors,
    flatlined: sensors.some((sensor) => sensor.state === "FLATLINED"),
  };
}
