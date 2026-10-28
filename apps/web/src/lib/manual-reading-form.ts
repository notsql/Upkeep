/** Local editable form state, not an API request DTO. */
export interface ManualReadingFields {
  assetId?: string;
  measuredAt: string;
  metric: string;
  value: string;
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
  if (!(fields.value.trim() && Number.isFinite(Number(fields.value)))) {
    return "Enter a numeric value.";
  }
  if (Math.abs(Number(fields.value)) >= 1_000_000_000_000) {
    return "Value must have at most 12 digits before the decimal point.";
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
