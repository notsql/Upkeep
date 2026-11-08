export const CSV_HEADER =
  "experiment,timestamp,vibrationAcceleration,pressure,temperature,flowRate,power,anomaly";

const VALUE_FIELDS = [
  "vibrationAcceleration",
  "pressure",
  "temperature",
  "flowRate",
  "power",
] as const;

export type ValueField = (typeof VALUE_FIELDS)[number];

export type CsvRow = {
  experiment: string;
  /** The row's timestamp, in epoch milliseconds. */
  time: number;
  anomaly: boolean;
} & Record<ValueField, number>;

export type ParseResult =
  | { ok: true; rows: CsvRow[] }
  | { ok: false; error: string };

const FIELD_COUNT = 8;
const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?<fraction>\.\d+)?(?<offset>Z|[+-]\d{2}:\d{2})$/u;
const BOM = /^\uFEFF/u;
const LINE_BREAK = /\r?\n/u;

const fail = (error: string): ParseResult => ({ ok: false, error });

function parseLine(
  line: string,
  lineNumber: number
): CsvRow | { error: string } {
  const fields = line.split(",");
  if (fields.length !== FIELD_COUNT) {
    return {
      error: `Line ${lineNumber}: expected ${FIELD_COUNT} fields, got ${fields.length}.`,
    };
  }
  const [experiment, timestamp, ...rest] = fields;
  const time = Date.parse(timestamp);
  if (!(ISO_WITH_OFFSET.test(timestamp) && Number.isFinite(time))) {
    return {
      error: `Line ${lineNumber}: timestamp must be ISO-8601 with an offset.`,
    };
  }
  const values = {} as Record<ValueField, number>;
  for (const [i, field] of VALUE_FIELDS.entries()) {
    const raw = rest[i].trim();
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value)) {
      return {
        error: `Line ${lineNumber}: ${field} must be a finite number.`,
      };
    }
    values[field] = value;
  }
  const anomaly = rest[VALUE_FIELDS.length];
  if (anomaly !== "0" && anomaly !== "1") {
    return { error: `Line ${lineNumber}: anomaly must be 0 or 1.` };
  }
  return { experiment, time, ...values, anomaly: anomaly === "1" };
}

/** Parses the test-readings CSV. The first bad line rejects the whole file. */
export function parseReadingsCsv(text: string): ParseResult {
  const lines = text.replace(BOM, "").split(LINE_BREAK);
  while (lines.length > 0 && lines.at(-1) === "") {
    lines.pop();
  }
  if (lines.length <= 1) {
    if (lines.length === 1 && lines[0] !== CSV_HEADER) {
      return fail(`Line 1: the header must be exactly ${CSV_HEADER}.`);
    }
    return fail("The file has no rows.");
  }
  if (lines[0] !== CSV_HEADER) {
    return fail(`Line 1: the header must be exactly ${CSV_HEADER}.`);
  }
  const rows: CsvRow[] = [];
  for (const [i, line] of lines.slice(1).entries()) {
    const parsed = parseLine(line, i + 2);
    if ("error" in parsed) {
      return fail(parsed.error);
    }
    rows.push(parsed);
  }
  return { ok: true, rows };
}

export interface Experiment {
  name: string;
  rowCount: number;
}

/** Each distinct experiment with its row count, in first-seen order. */
export function experiments(rows: CsvRow[]): Experiment[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.experiment, (counts.get(row.experiment) ?? 0) + 1);
  }
  return [...counts].map(([name, rowCount]) => ({ name, rowCount }));
}

export interface AnomalyWindow {
  end: number;
  length: number;
  start: number;
}

/** Runs of consecutive `anomaly = 1` rows, as 0-based row offsets. */
export function anomalyWindows(rows: CsvRow[]): AnomalyWindow[] {
  const windows: AnomalyWindow[] = [];
  let start: number | undefined;
  const close = (end: number) => {
    if (start !== undefined) {
      windows.push({ start, end, length: end - start + 1 });
      start = undefined;
    }
  };
  for (const [i, row] of rows.entries()) {
    if (row.anomaly) {
      start ??= i;
    } else {
      close(i - 1);
    }
  }
  close(rows.length - 1);
  return windows;
}
