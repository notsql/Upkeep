import type { components } from "@proj/api/schema";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { assetQueryKey } from "@/lib/assets";
import type { DeviceMetric } from "@/lib/devices";
import { estateError, useEstateSession } from "@/lib/estates";

export type AssetReadingPage = components["schemas"]["AssetReadingPage"];
export type AssetReading = components["schemas"]["AssetReadingResponse"];
export type ReadingFlag = components["schemas"]["ReadingFlagResponse"];

/** The list's filters as they live in the URL. Times are `datetime-local` values. */
export interface ReadingFilters {
  from?: string;
  metric?: DeviceMetric;
  page?: number;
  suspect?: boolean;
  to?: string;
}

export const READINGS_PAGE_SIZE = 50;

const SUSPECT_FLAGS: ReadingFlag["type"][] = [
  "GAP",
  "DUPLICATE_TIMESTAMP",
  "OUT_OF_RANGE",
];

const GAP_UNITS: [string, number][] = [
  ["d", 86_400],
  ["h", 3600],
  ["m", 60],
  ["s", 1],
];

/** A gap length such as "2h 5m"; zero parts are left out. */
export function formatGap(seconds: number): string {
  let left = seconds;
  const parts: string[] = [];
  for (const [unit, size] of GAP_UNITS) {
    const count = Math.floor(left / size);
    left -= count * size;
    if (count > 0) {
      parts.push(`${count}${unit}`);
    }
  }
  return parts.join(" ") || "0s";
}

/** Badge text for a flag; the range comes from the server, never from here. */
export function flagLabel(flag: ReadingFlag, unit: string): string {
  if (flag.type === "GAP") {
    return `Gap ${formatGap(flag.gapSeconds ?? 0)}`;
  }
  if (flag.type === "DUPLICATE_TIMESTAMP") {
    return "Duplicate timestamp";
  }
  return `Out of range (valid ${flag.validMin?.toLocaleString()} to ${flag.validMax?.toLocaleString()} ${unit})`;
}

export function readingsQueryKey(
  userId: string | undefined,
  estateId: string,
  assetId: string,
  filters: ReadingFilters
) {
  return [
    ...assetQueryKey(userId, estateId, assetId),
    "readings",
    filters,
  ] as const;
}

function instant(local: string | undefined): string | undefined {
  return local ? new Date(local).toISOString() : undefined;
}

export function useReadings(
  estateId: string,
  assetId: string,
  filters: ReadingFilters
) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: readingsQueryKey(userId, estateId, assetId, filters),
    enabled: ready,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const query = {
        metric: filters.metric,
        from: instant(filters.from),
        to: instant(filters.to),
        flag: filters.suspect ? SUSPECT_FLAGS : undefined,
        page: filters.page ?? 0,
        size: READINGS_PAGE_SIZE,
      };
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/readings",
        {
          params: {
            path: { estateId, assetId },
            query: Object.fromEntries(
              Object.entries(query).filter(([, value]) => value !== undefined)
            ) as typeof query,
          },
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}
