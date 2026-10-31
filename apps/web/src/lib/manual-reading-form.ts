/** Local editable form state, not an API request DTO. */
export interface ManualReadingFields {
  assetId?: string;
  measuredAt: string;
  metric: string;
  value: string;
}

const DECIMAL = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/;
const LEADING_ZEROES = /^0+/;
const TRAILING_ZEROES = /0+$/;
const INTEGER_LIMIT =
  "Value must have at most 12 digits before the decimal point.";
const FRACTION_LIMIT = "Value can have at most six decimal places.";

function plainDecimal(digits: string, scale: number): string {
  if (scale <= 0) {
    return digits + "0".repeat(-scale);
  }
  if (scale >= digits.length) {
    return `0.${"0".repeat(scale - digits.length)}${digits}`;
  }
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

/** Canonical decimal text; no floating-point conversion of the measurement. */
export function parseManualReadingValue(
  input: string
): { decimal: string } | { error: string } {
  const match = input.trim().match(DECIMAL);
  if (!match) {
    return { error: "Enter a numeric value." };
  }
  const fraction = match[3] ?? match[4] ?? "";
  const nonzero = ((match[2] ?? "") + fraction).replace(LEADING_ZEROES, "");
  if (!nonzero) {
    return { decimal: "0" };
  }
  const exponent = Number(match[5] ?? "0");
  if (!Number.isSafeInteger(exponent)) {
    return { error: exponent > 0 ? INTEGER_LIMIT : FRACTION_LIMIT };
  }
  const digits = nonzero.replace(TRAILING_ZEROES, "");
  const scale = fraction.length - exponent - (nonzero.length - digits.length);
  if (digits.length - scale > 12) {
    return { error: INTEGER_LIMIT };
  }
  if (scale > 6) {
    return { error: FRACTION_LIMIT };
  }
  // Expansion occurs only after both bounds have been checked, including exponents.
  const sign = match[1] === "-" ? "-" : "";
  return { decimal: sign + plainDecimal(digits, scale) };
}

export function currentLocalMeasurementTime(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function manualReadingError(
  fields: ManualReadingFields
): string | undefined {
  if (!fields.assetId) {
    return "Choose an asset.";
  }
  if (!fields.metric) {
    return "Choose a metric.";
  }
  const value = parseManualReadingValue(fields.value);
  if ("error" in value) {
    return value.error;
  }
  const time = new Date(fields.measuredAt).getTime();
  if (!(fields.measuredAt && Number.isFinite(time))) {
    return "Enter a valid measurement time.";
  }
  if (time > Date.now() + 5 * 60_000) {
    return "Measurement time cannot be more than five minutes in the future.";
  }
  return undefined;
}
