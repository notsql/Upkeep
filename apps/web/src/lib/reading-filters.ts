import { deviceMetrics } from "@/lib/devices";

const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** URL/form state deliberately retains invalid input so it can be explained before a request. */
export interface ReadingSearch {
  assetId?: string;
  from?: string;
  metric?: string;
  page?: number;
  suspect?: boolean;
  to?: string;
}

/** Apply edits against the latest URL, not the render that preceded a pending navigation. */
export function mergeReadingSearch(
  latest: ReadingSearch,
  base: ReadingSearch,
  next: ReadingSearch
): ReadingSearch {
  if (Object.keys(next).length === 0) {
    return {};
  }
  const merged = { ...latest };
  for (const field of [
    "assetId",
    "metric",
    "from",
    "to",
    "suspect",
    "page",
  ] as const) {
    if (
      next[field] !== base[field] ||
      (field === "page" && Object.hasOwn(next, field))
    ) {
      Object.assign(merged, { [field]: next[field] });
    }
  }
  return merged;
}

function text(value: unknown): string | undefined {
  return value === undefined || value === null || value === ""
    ? undefined
    : String(value);
}

export function parseReadingSearch(
  search: Record<string, unknown>
): ReadingSearch {
  const page = Number(search.page);
  return {
    assetId: text(search.assetId),
    metric: text(search.metric),
    from: text(search.from),
    to: text(search.to),
    page: Number.isSafeInteger(page) && page > 0 ? page : undefined,
    suspect:
      search.suspect === true || search.suspect === "true" ? true : undefined,
  };
}

function validLocalDateTime(value: string): boolean {
  if (!LOCAL_DATE_TIME.test(value)) {
    return false;
  }
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second = 0] = timePart.split(":").map(Number);
  const date = new Date(value);
  return (
    Number.isFinite(date.getTime()) &&
    Number(year) > 0 &&
    date.getFullYear() === Number(year) &&
    date.getMonth() + 1 === Number(month) &&
    date.getDate() === Number(day) &&
    date.getHours() === Number(hour) &&
    date.getMinutes() === Number(minute) &&
    date.getSeconds() === Number(second)
  );
}

export function readingFilterError(filters: ReadingSearch): string | undefined {
  if (filters.assetId && !UUID.test(filters.assetId)) {
    return "Choose a valid asset or clear the asset filter.";
  }
  if (filters.metric && !Object.hasOwn(deviceMetrics, filters.metric)) {
    return "Choose a valid metric or clear the metric filter.";
  }
  if (filters.from && !validLocalDateTime(filters.from)) {
    return "Enter a valid start date and time.";
  }
  if (filters.to && !validLocalDateTime(filters.to)) {
    return "Enter a valid end date and time.";
  }
  if (
    filters.from &&
    filters.to &&
    new Date(filters.from).getTime() >= new Date(filters.to).getTime()
  ) {
    return "Start time must be before end time.";
  }
  return undefined;
}
