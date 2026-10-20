import type { SensorPolicy } from "@/lib/flatlined-sensors";

export function metricLabel(metric: SensorPolicy["metric"]): string {
  return metric.charAt(0) + metric.slice(1).toLowerCase().replaceAll("_", " ");
}

const WHOLE_NUMBER = /^\d+$/;

export function wholeMinutes(
  value: string,
  unit: "minutes" | "hours",
  maximum: number
): number {
  const minutes = Number(value) * (unit === "hours" ? 60 : 1);
  if (
    !(WHOLE_NUMBER.test(value) && Number.isSafeInteger(minutes)) ||
    minutes < 1 ||
    minutes > maximum
  ) {
    throw new Error(
      `Use whole-number minutes or hours, from 1 to ${maximum.toLocaleString()} minutes.`
    );
  }
  return minutes;
}

export function timeLabel(at: string): string {
  return new Date(at).toLocaleString();
}
