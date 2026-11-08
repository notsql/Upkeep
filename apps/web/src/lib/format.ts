import { type DeviceMetric, deviceMetrics } from "@/lib/devices";

/**
 * Shared display formatting, built only on Intl (spec asset-readings-charts).
 * Locale and time zone default to the browser's; tests pass them explicitly.
 */
export interface FormatOptions {
  locale?: string;
  timeZone?: string;
}

const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

function dateTimeFormat(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const key = `d|${locale}|${JSON.stringify(options)}`;
  let formatter = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    cache.set(key, formatter);
  }
  return formatter;
}

function numberFormat(
  locale: string | undefined,
  options: Intl.NumberFormatOptions
): Intl.NumberFormat {
  const key = `n|${locale}|${JSON.stringify(options)}`;
  let formatter = cache.get(key) as Intl.NumberFormat | undefined;
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    cache.set(key, formatter);
  }
  return formatter;
}

const DATE_ONLY = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u;

/** A `YYYY-MM-DD` calendar date as a medium date, the same day everywhere. */
export function formatDate(value: string, options: FormatOptions = {}): string {
  const match = DATE_ONLY.exec(value);
  if (!match) {
    return value;
  }
  const year = Number(match.groups?.year);
  const month = Number(match.groups?.month);
  const day = Number(match.groups?.day);
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  if (!valid) {
    return value;
  }
  return dateTimeFormat(options.locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

/** An ISO instant as a medium date plus a time with seconds. */
export function formatDateTime(
  instant: string,
  options: FormatOptions = {}
): string {
  return dateTimeFormat(options.locale, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: options.timeZone,
  }).format(new Date(instant));
}

/** An ISO instant as a time with seconds. */
export function formatTime(
  instant: string,
  options: FormatOptions = {}
): string {
  return dateTimeFormat(options.locale, {
    timeStyle: "medium",
    timeZone: options.timeZone,
  }).format(new Date(instant));
}

/** An ISO instant as hours and minutes ("9:01 pm"), for chart time ticks. */
export function formatClock(
  instant: string,
  options: FormatOptions = {}
): string {
  return dateTimeFormat(options.locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: options.timeZone,
  }).format(new Date(instant));
}

/** Seconds since local midnight, for aligning chart ticks to round wall times. */
export function localSecondOfDay(
  instant: number,
  options: FormatOptions = {}
): number {
  const parts = dateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: options.timeZone,
  }).formatToParts(new Date(instant));
  const part = (type: string): number =>
    Number(parts.find((candidate) => candidate.type === type)?.value ?? 0);
  return part("hour") * 3600 + part("minute") * 60 + part("second");
}

const DURATION_UNITS: [string, number][] = [
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

/** A duration in its largest whole unit up to hours ("1 sec", "5 mins", "2.3 hrs"). */
export function formatDuration(
  seconds: number,
  options: FormatOptions = {}
): string {
  const [unit, size] = DURATION_UNITS.find(
    ([, length]) => seconds >= length
  ) ?? ["second", 1];
  return numberFormat(options.locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(seconds / size);
}

/** A short day and hour ("Sat, 9 pm"), for the 24 h chart axis. */
export function formatDayHour(
  instant: string,
  options: FormatOptions = {}
): string {
  return dateTimeFormat(options.locale, {
    weekday: "short",
    hour: "numeric",
    timeZone: options.timeZone,
  }).format(new Date(instant));
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400],
  ["hour", 3600],
  ["minute", 60],
];

const relativeCache = new Map<string, Intl.RelativeTimeFormat>();

/** "2 min ago", "yesterday"; always shown alongside an absolute time. */
export function formatRelative(
  instant: string,
  now: Date,
  options: FormatOptions = {}
): string {
  const key = `${options.locale}`;
  let formatter = relativeCache.get(key);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(options.locale, {
      numeric: "auto",
      style: "short",
    });
    relativeCache.set(key, formatter);
  }
  const seconds = Math.round(
    (new Date(instant).getTime() - now.getTime()) / 1000
  );
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
  return formatter.format(seconds, "second");
}

const METRIC_FORMATS: Record<
  DeviceMetric,
  { number: Intl.NumberFormatOptions; intlUnit?: boolean }
> = {
  TEMPERATURE: {
    number: { style: "unit", unit: "celsius", ...fractionDigits(1) },
    intlUnit: true,
  },
  HUMIDITY: {
    number: { style: "unit", unit: "percent", ...fractionDigits(0) },
    intlUnit: true,
  },
  PRESSURE: { number: fractionDigits(2) },
  FLOW_RATE: { number: fractionDigits(1) },
  VIBRATION: { number: fractionDigits(2) },
  VIBRATION_ACCELERATION: {
    number: { minimumSignificantDigits: 3, maximumSignificantDigits: 3 },
  },
  POWER: { number: fractionDigits(2) },
  ENERGY: { number: fractionDigits(1) },
};

function fractionDigits(digits: number): Intl.NumberFormatOptions {
  return { minimumFractionDigits: digits, maximumFractionDigits: digits };
}

/** A reading value with its metric's precision and unit. */
export function formatMetricValue(
  metric: DeviceMetric,
  value: number | string,
  options: FormatOptions = {}
): string {
  const format = METRIC_FORMATS[metric];
  const text = numberFormat(options.locale, format.number).format(
    Number(value)
  );
  return format.intlUnit ? text : `${text} ${deviceMetrics[metric].unit}`;
}

/** A reading value with its metric's precision, for a column whose header carries the unit. */
export function formatMetricNumber(
  metric: DeviceMetric,
  value: number | string,
  options: FormatOptions = {}
): string {
  const {
    style: _style,
    unit: _unit,
    ...number
  } = METRIC_FORMATS[metric].number;
  return numberFormat(options.locale, number).format(Number(value));
}

/** An anomaly score to 2 fraction digits. */
export function formatScore(
  score: number,
  options: FormatOptions = {}
): string {
  return numberFormat(options.locale, fractionDigits(2)).format(score);
}

/** A fraction as a percent to 1 digit ("3.2%"); `signed` adds "+" or "-" ("+3.2%"). */
export function formatPercent(
  value: number,
  options: FormatOptions & { signed?: boolean } = {}
): string {
  return numberFormat(options.locale, {
    style: "percent",
    signDisplay: options.signed ? "exceptZero" : "auto",
    ...fractionDigits(1),
  }).format(value);
}

/** A plain number, such as a valid-range limit. */
export function formatNumber(
  value: number,
  options: FormatOptions = {}
): string {
  return numberFormat(options.locale, {}).format(value);
}

const MODEL_RECORDER = "system:anomaly-model";
const INSTANT = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/gu;

function localDay(instant: string, options: FormatOptions): string {
  return dateTimeFormat("en-CA", {
    dateStyle: "short",
    timeZone: options.timeZone,
  }).format(new Date(instant));
}

/**
 * Model notes embed ISO instants (AnomalyScoringService's template); they are
 * reformatted here, the second as a time when on the same local day. A
 * person's notes are returned as typed.
 */
export function formatAssessmentNotes(
  assessment: { notes?: string; recordedByUserId?: string },
  options: FormatOptions = {}
): string {
  const notes = assessment.notes ?? "";
  if (assessment.recordedByUserId !== MODEL_RECORDER) {
    return notes;
  }
  let previous: string | undefined;
  return notes.replace(INSTANT, (instant) => {
    const sameDay =
      previous !== undefined &&
      localDay(previous, options) === localDay(instant, options);
    previous = instant;
    return sameDay
      ? formatTime(instant, options)
      : formatDateTime(instant, options);
  });
}
