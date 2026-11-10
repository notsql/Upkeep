import type { SensorPolicy } from "@/lib/flatlined-sensors";

export function PolicySummary({ policy }: { policy: SensorPolicy }) {
  if (policy.durationMinutes === null) {
    return "No warning set";
  }
  return `${policy.durationMinutes} ${policy.durationMinutes === 1 ? "minute" : "minutes"} · allows ${policy.tolerance} ${policy.unit} change`;
}
