import type { components } from "@proj/api/schema";
import type { CsvRow, ValueField } from "@/lib/csv";

export type Reading = components["schemas"]["CreateReadingRequest"];
export type Mode = "backfill" | "live";

export const MAX_BATCH = 500;

const METRICS: [ValueField, Reading["metric"], string][] = [
  ["vibrationAcceleration", "VIBRATION_ACCELERATION", "g"],
  ["pressure", "PRESSURE", "bar"],
  ["temperature", "TEMPERATURE", "°C"],
  ["flowRate", "FLOW_RATE", "L/min"],
  ["power", "POWER", "kW"],
];

/** One CSV row becomes five readings sharing one measuredAt. */
export function toReadings(row: CsvRow, at: number): Reading[] {
  const measuredAt = new Date(at).toISOString();
  return METRICS.map(([field, metric, unit]) => ({
    metric,
    value: row[field],
    unit,
    measuredAt,
  }));
}

export interface ShiftedRow {
  at: number;
  row: CsvRow;
}

/**
 * Shifts every row by one offset, so spacing and gaps are preserved. Backfill
 * puts the last row at `start`; live puts the first row there.
 */
export function shiftRows(
  rows: CsvRow[],
  mode: Mode,
  start: number
): ShiftedRow[] {
  const anchor = mode === "backfill" ? rows.at(-1)?.time : rows[0]?.time;
  const offset = start - (anchor ?? 0);
  return rows.map((row) => ({ row, at: row.time + offset }));
}

export function splitBatches<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}
