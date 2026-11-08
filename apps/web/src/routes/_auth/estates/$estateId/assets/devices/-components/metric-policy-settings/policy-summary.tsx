import type { SensorPolicy } from "@/lib/flatlined-sensors";

export function PolicySummary({ policy }: { policy: SensorPolicy }) {
  if (policy.durationMinutes === null) {
    return "No policy";
  }
  return `${policy.durationMinutes} ${policy.durationMinutes === 1 ? "minute" : "minutes"} · tolerance ${policy.tolerance} ${policy.unit}`;
}
