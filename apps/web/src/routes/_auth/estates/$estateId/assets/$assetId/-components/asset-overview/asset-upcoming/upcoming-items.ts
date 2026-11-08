import type { AssetEvent } from "@/lib/asset-events";
import type { InspectionCheck } from "@/lib/inspection-list";
import type { ServiceInterval } from "@/lib/service-intervals";

/** Work due within this many days shows as "soon" (amber). */
export const UPCOMING_SOON_DAYS = 14;

export type UpcomingTone = "overdue" | "soon" | "later";
export type UpcomingKind = "inspection" | "service";

export type UpcomingItem = {
  id: string;
  kind: UpcomingKind;
  title: string;
  /** YYYY-MM-DD */
  dueOn: string;
};

const DAY_MS = 86_400_000;

function utc(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function iso(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** Whole calendar days from `today` to `dueOn`; negative when past. */
export function daysUntil(dueOn: string, today: string): number {
  return Math.round((utc(dueOn) - utc(today)) / DAY_MS);
}

export function upcomingTone(dueOn: string, today: string): UpcomingTone {
  const days = daysUntil(dueOn, today);
  if (days < 0) {
    return "overdue";
  }
  return days <= UPCOMING_SOON_DAYS ? "soon" : "later";
}

function plural(count: number): string {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

/** "Due today", "in 5 days", "3 days overdue". */
export function relativeDue(dueOn: string, today: string): string {
  const days = daysUntil(dueOn, today);
  if (days === 0) {
    return "Due today";
  }
  return days > 0 ? `in ${plural(days)}` : `${plural(-days)} overdue`;
}

/** A date plus an interval; month and year steps keep to the month's last day. */
export function addInterval(date: string, interval: ServiceInterval): string {
  if (interval.unit === "DAY") {
    return iso(utc(date) + interval.value * DAY_MS);
  }
  const [year, month, day] = date.split("-").map(Number);
  const months =
    interval.unit === "YEAR" ? interval.value * 12 : interval.value;
  const target = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(day ?? 1, lastDay));
  return iso(target.getTime());
}

/** This asset's checks on the estate inspection list that are not done. */
export function inspectionItems(
  checks: InspectionCheck[],
  assetId: string
): UpcomingItem[] {
  return checks
    .filter((check) => check.assetId === assetId && check.status !== "DONE")
    .map((check) => ({
      id: `inspection-${check.id}`,
      kind: "inspection",
      title: "Inspection due",
      dueOn: check.dueOn,
    }));
}

/**
 * The next service: the last preventive service (or installation, if never
 * serviced) plus the effective interval. None without both.
 */
export function serviceItem(
  events: Pick<AssetEvent, "type" | "occurredOn">[],
  interval: ServiceInterval | null | undefined,
  installedOn: string | null | undefined
): UpcomingItem | undefined {
  const lastService = events
    .filter((event) => event.type === "PREVENTIVE")
    .map((event) => event.occurredOn)
    .sort()
    .at(-1);
  const from = lastService ?? installedOn;
  if (!(interval && from)) {
    return;
  }
  return {
    id: "service",
    kind: "service",
    title: "Service due",
    dueOn: addInterval(from, interval),
  };
}
