import { describe, expect, it } from "vitest";
import {
  deviceSummaries,
  deviceSummaryTones,
  groupAssetsByLocation,
  rankDevices,
} from "@/lib/asset-monitoring";
import type { Asset } from "@/lib/assets";
import type { EstateDevice } from "@/lib/devices";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";
import type { Location } from "@/lib/locations";

const BLOCK_A = "0b8f2a7e-6d3c-4b1a-9e5f-1a2b3c4d5e01";
const BLOCK_B = "0b8f2a7e-6d3c-4b1a-9e5f-1a2b3c4d5e02";
const A_L1 = "0b8f2a7e-6d3c-4b1a-9e5f-1a2b3c4d5e03";
const A_L2 = "0b8f2a7e-6d3c-4b1a-9e5f-1a2b3c4d5e04";
const A_L1_ROOM = "0b8f2a7e-6d3c-4b1a-9e5f-1a2b3c4d5e05";
const MISSING = "0b8f2a7e-6d3c-4b1a-9e5f-1a2b3c4d5e06";

function location(
  id: string,
  name: string,
  type: Location["type"],
  parentId?: string,
  sortOrder?: number
): Location {
  return {
    id,
    name,
    type,
    parentId: parentId ?? null,
    sortOrder: sortOrder ?? null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

const locations: Location[] = [
  location(BLOCK_A, "Block A", "BLOCK"),
  location(BLOCK_B, "Block B", "BLOCK"),
  location(A_L1, "L1", "LEVEL", BLOCK_A, 1),
  location(A_L2, "L2", "LEVEL", BLOCK_A, 2),
  location(A_L1_ROOM, "Pump room", "COMMON_AREA", A_L1),
];

function asset(id: string, locationId: string): Asset {
  return {
    id,
    estateId: "estate",
    reference: id,
    name: id,
    category: "PUMP",
    locationId,
    locationPath: "",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    lifecycleVersion: 0,
  };
}

describe("groupAssetsByLocation", () => {
  it("groups by block then level in location-tree order, keeping input order within a group", () => {
    const groups = groupAssetsByLocation(
      [
        asset("unknown", MISSING),
        asset("room", A_L1_ROOM),
        asset("b-wide", BLOCK_B),
        asset("l1", A_L1),
        asset("l2", A_L2),
        asset("a-wide", BLOCK_A),
      ],
      locations
    );
    expect(
      groups.map((block) => ({
        name: block.name,
        levels: block.levels.map((level) => ({
          name: level.name,
          assets: level.assets.map((item) => item.id),
        })),
      }))
    ).toEqual([
      {
        name: "Block A",
        levels: [
          { name: "Block-wide", assets: ["a-wide"] },
          { name: "L2", assets: ["l2"] },
          { name: "L1", assets: ["room", "l1"] },
        ],
      },
      {
        name: "Block B",
        levels: [{ name: "Block-wide", assets: ["b-wide"] }],
      },
      {
        name: "Unknown location",
        levels: [{ name: null, assets: ["unknown"] }],
      },
    ]);
  });
});

function device(assetId: string, status: EstateDevice["status"]): EstateDevice {
  return { assetId, status } as EstateDevice;
}

describe("deviceSummaries", () => {
  it("counts online devices, treats offline and awaiting as not online, and ignores deactivated ones", () => {
    const summaries = deviceSummaries([
      device("all-online", "ONLINE"),
      device("all-online", "ONLINE"),
      device("one-off", "ONLINE"),
      device("one-off", "OFFLINE"),
      device("awaiting", "AWAITING_FIRST_READING"),
      device("awaiting", "DEACTIVATED"),
      device("gone", "DEACTIVATED"),
      device("single", "ONLINE"),
    ]);
    expect(summaries("all-online")).toBe("2 sensors online");
    expect(summaries("one-off")).toBe("1 of 2 offline");
    expect(summaries("awaiting")).toBe("1 of 1 offline");
    expect(summaries("gone")).toBe("No sensors");
    expect(summaries("none")).toBe("No sensors");
    expect(summaries("single")).toBe("1 sensor online");
  });
});

function estateDevice(
  id: string,
  assetName: string,
  status: EstateDevice["status"]
): EstateDevice {
  return {
    id,
    identifier: id,
    assetId: `asset-${assetName}`,
    assetName,
    assetReference: assetName,
    status,
  } as EstateDevice;
}

function entry(
  deviceId: string,
  assetName: string,
  state: MonitoredSensor["state"],
  metric: MonitoredSensor["metric"] = "TEMPERATURE"
): MonitoredSensor {
  return {
    deviceId,
    deviceIdentifier: deviceId,
    assetId: `asset-${assetName}`,
    assetName,
    assetReference: assetName,
    deviceLocationPath: "Block A",
    metric,
    state,
  } as MonitoredSensor;
}

describe("rankDevices", () => {
  it("puts a flatlined online device above an offline one", () => {
    const ranked = rankDevices(
      [
        estateDevice("off", "Pump", "OFFLINE"),
        estateDevice("flat", "Pump", "ONLINE"),
      ],
      [entry("flat", "Pump", "FLATLINED")]
    );
    expect(ranked.map((row) => row.deviceId)).toEqual(["flat", "off"]);
    expect(ranked[0]?.flatlined).toBe(true);
    expect(ranked[0]?.sensors).toHaveLength(1);
  });

  it("orders offline, awaiting first reading, online, then deactivated", () => {
    const ranked = rankDevices(
      [
        estateDevice("gone", "Pump", "DEACTIVATED"),
        estateDevice("on", "Pump", "ONLINE"),
        estateDevice("wait", "Pump", "AWAITING_FIRST_READING"),
        estateDevice("off", "Pump", "OFFLINE"),
      ],
      []
    );
    expect(ranked.map((row) => row.deviceId)).toEqual([
      "off",
      "wait",
      "on",
      "gone",
    ]);
  });

  it("ranks paused devices by device status and breaks ties by asset name then identifier", () => {
    const ranked = rankDevices(
      [
        estateDevice("b-2", "Boiler", "ONLINE"),
        estateDevice("paused", "Air handler", "ONLINE"),
        estateDevice("b-1", "Boiler", "ONLINE"),
      ],
      [entry("paused", "Air handler", "PAUSED")]
    );
    expect(ranked.map((row) => row.deviceId)).toEqual(["paused", "b-1", "b-2"]);
    expect(ranked[0]?.flatlined).toBe(false);
  });

  it("builds rows from the review alone when there is no device list", () => {
    const ranked = rankDevices(null, [
      entry("calm", "Air handler", "MONITORING"),
      entry("flat", "Boiler", "MONITORING", "TEMPERATURE"),
      entry("flat", "Boiler", "FLATLINED", "HUMIDITY"),
    ]);
    expect(ranked.map((row) => row.deviceId)).toEqual(["flat", "calm"]);
    expect(ranked[0]).toMatchObject({
      identifier: "flat",
      assetName: "Boiler",
      locationPath: "Block A",
      status: null,
    });
    expect(ranked[0]?.sensors).toHaveLength(2);
  });
});

describe("deviceSummaryTones", () => {
  it("is success when every device is online, the offline tone when any is not, and muted with none", () => {
    const tones = deviceSummaryTones([
      device("all-online", "ONLINE"),
      device("one-off", "ONLINE"),
      device("one-off", "OFFLINE"),
      device("gone", "DEACTIVATED"),
    ]);
    expect(tones("all-online")).toBe("success");
    expect(tones("one-off")).toBe("danger");
    expect(tones("gone")).toBe("muted");
    expect(tones("none")).toBe("muted");
  });
});
