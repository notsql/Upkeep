import { describe, expect, it } from "vitest";
import type { CsvRow } from "@/lib/csv";
import { shiftRows, splitBatches, toReadings } from "@/lib/readings";

const at = (time: number): CsvRow => ({
  experiment: "a",
  time,
  vibrationAcceleration: 0.08,
  pressure: 1.2,
  temperature: 88.8,
  flowRate: 75,
  power: 0.5,
  anomaly: false,
});

describe("toReadings", () => {
  it("maps a row to five readings sharing one measuredAt", () => {
    expect(toReadings(at(0), Date.parse("2026-11-07T00:00:00Z"))).toEqual([
      {
        metric: "VIBRATION_ACCELERATION",
        value: 0.08,
        unit: "g",
        measuredAt: "2026-11-07T00:00:00.000Z",
      },
      {
        metric: "PRESSURE",
        value: 1.2,
        unit: "bar",
        measuredAt: "2026-11-07T00:00:00.000Z",
      },
      {
        metric: "TEMPERATURE",
        value: 88.8,
        unit: "°C",
        measuredAt: "2026-11-07T00:00:00.000Z",
      },
      {
        metric: "FLOW_RATE",
        value: 75,
        unit: "L/min",
        measuredAt: "2026-11-07T00:00:00.000Z",
      },
      {
        metric: "POWER",
        value: 0.5,
        unit: "kW",
        measuredAt: "2026-11-07T00:00:00.000Z",
      },
    ]);
  });
});

describe("shiftRows", () => {
  const rows = [at(1000), at(2000), at(7000)];

  it("backfill puts the last row at the start time, preserving gaps", () => {
    expect(shiftRows(rows, "backfill", 100_000).map((r) => r.at)).toEqual([
      94_000, 95_000, 100_000,
    ]);
  });

  it("live puts the first row at the start time, preserving gaps", () => {
    expect(shiftRows(rows, "live", 100_000).map((r) => r.at)).toEqual([
      100_000, 101_000, 106_000,
    ]);
  });
});

describe("splitBatches", () => {
  it("splits into batches of at most 500", () => {
    const items = Array.from({ length: 1201 }, (_, i) => i);
    expect(splitBatches(items, 500).map((b) => b.length)).toEqual([
      500, 500, 201,
    ]);
  });

  it("returns no batches for no items", () => {
    expect(splitBatches([], 500)).toEqual([]);
  });
});
