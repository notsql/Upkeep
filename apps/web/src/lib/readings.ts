import type { components } from "@proj/api/schema";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { useAppAccess } from "@/lib/access";
import { api } from "@/lib/api";
import { assetQueryKey } from "@/lib/assets";
import type { DeviceMetric } from "@/lib/devices";
import { estateError, useEstateSession } from "@/lib/estates";
import { formatNumber, formatScore } from "@/lib/format";
import { type ReadingSearch, readingFilterError } from "@/lib/reading-filters";

export type AssetReadingPage = components["schemas"]["AssetReadingPage"];
export type AssetReading = components["schemas"]["AssetReadingResponse"];
export type ReadingFlag = components["schemas"]["ReadingFlagResponse"];
export type EstateReading = components["schemas"]["EstateReadingResponse"];
export type ReadingAsset = components["schemas"]["ReadingAssetOption"];
export type ReadingGroup = components["schemas"]["ReadingGroup"];
export type ReadingGroupPage = components["schemas"]["ReadingGroupPage"];

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

/** Anomalies are findings, not suspect data, so they stand out. */
export function flagVariant(flag: ReadingFlag): "destructive" | "outline" {
  return flag.type === "ANOMALY" ? "destructive" : "outline";
}

/** "Match any" of the chosen flag kinds; undefined when neither is chosen. */
function flagQuery(
  filters: Pick<ReadingSearch, "suspect" | "anomalous">
): ReadingFlag["type"][] | undefined {
  const flags: ReadingFlag["type"][] = [
    ...(filters.suspect ? SUSPECT_FLAGS : []),
    ...(filters.anomalous ? (["ANOMALY"] as const) : []),
  ];
  return flags.length ? flags : undefined;
}

/** Badge text for a flag; the range comes from the server, never from here. */
export function flagLabel(flag: ReadingFlag, unit: string): string {
  if (flag.type === "GAP") {
    return `Gap ${formatGap(flag.gapSeconds ?? 0)}`;
  }
  if (flag.type === "DUPLICATE_TIMESTAMP") {
    return "Duplicate timestamp";
  }
  if (flag.type === "ANOMALY") {
    return `Anomaly ${formatScore(flag.anomalyScore ?? 0)}`;
  }
  return `Out of range (valid ${formatNumber(flag.validMin ?? 0)} to ${formatNumber(flag.validMax ?? 0)} ${unit})`;
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

const LIVE_REFETCH_MS = 1000;
const BACKGROUND_REFETCH_MS = 60_000;

export const READING_GROUPS_PAGE_SIZE = 50;

/**
 * The asset readings page: grouped readings under the URL filters, appended
 * through `nextBefore`. Suspect-flag filters with no dates can take seconds on
 * a 1 Hz asset, so nothing refetches in the background or on focus.
 */
export function useAssetReadingGroupPages(
  estateId: string,
  assetId: string,
  filters: ReadingSearch
) {
  const { userId, ready } = useEstateSession();
  const { metric, from, to, suspect, anomalous } = filters;
  const key = { metric, from, to, suspect, anomalous };
  return useInfiniteQuery({
    queryKey: [userId, "reading-groups", estateId, assetId, "pages", key],
    enabled: ready && !readingFilterError(filters),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page: ReadingGroupPage) => page.nextBefore,
    queryFn: async ({ pageParam }): Promise<ReadingGroupPage> => {
      const query = {
        limit: READING_GROUPS_PAGE_SIZE,
        before: pageParam,
        from: instant(from),
        to: instant(to),
        metric: metric ? [metric as DeviceMetric] : undefined,
        flag: flagQuery(filters),
      };
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/readings/grouped",
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

export type ReadingSeries = components["schemas"]["ReadingSeriesResponse"];
export type MetricSeries = components["schemas"]["MetricSeries"];

/** The Trends card's ranges; each ends at "now" when the query runs. */
export const READING_RANGES = {
  "1m": { label: "1 min", phrase: "last 1 minute", ms: 60_000 },
  "15m": { label: "15 min", phrase: "last 15 minutes", ms: 900_000 },
  "1h": { label: "1 h", phrase: "last 1 hour", ms: 3_600_000 },
  "24h": { label: "24 h", phrase: "last 24 hours", ms: 86_400_000 },
} as const;

export type ReadingRange = keyof typeof READING_RANGES;

/** Bucketed device readings for the chart; the key names the range, not instants. */
export function useAssetReadingSeries(
  estateId: string,
  assetId: string,
  range: ReadingRange,
  live: boolean
) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: [userId, "reading-series", estateId, assetId, range],
    enabled: ready,
    retry: false,
    placeholderData: keepPreviousData,
    refetchInterval: live ? LIVE_REFETCH_MS : BACKGROUND_REFETCH_MS,
    queryFn: async () => {
      const to = Date.now();
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/readings/series",
        {
          params: {
            path: { estateId, assetId },
            query: {
              from: new Date(to - READING_RANGES[range].ms).toISOString(),
              to: new Date(to).toISOString(),
            },
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

export function readingFilterQuery(filters: ReadingSearch) {
  return {
    assetId: filters.assetId,
    metric: filters.metric as DeviceMetric | undefined,
    from: instant(filters.from),
    to: instant(filters.to),
    flag: flagQuery(filters),
  };
}

export function useEstateReadings(estateId: string, filters: ReadingSearch) {
  const { userId, ready } = useEstateSession();
  const access = useAppAccess();
  const allowed = access.data?.estates.some(
    (estate) => estate.estateId === estateId && estate.canViewReadings
  );
  return useQuery({
    queryKey: [userId, "estate-readings", estateId, filters],
    enabled: ready && !!allowed && !readingFilterError(filters),
    retry: false,
    placeholderData: (previous, query) =>
      query?.queryKey[0] === userId && query?.queryKey[2] === estateId
        ? previous
        : undefined,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/readings",
        {
          params: {
            path: { estateId },
            query: {
              ...readingFilterQuery(filters),
              page: filters.page ?? 0,
              size: READINGS_PAGE_SIZE,
            },
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

export function useReadingAssets(
  estateId: string,
  search = "",
  page = 0,
  enabled = true
) {
  const { userId, ready } = useEstateSession();
  const access = useAppAccess();
  const allowed = access.data?.estates.some(
    (estate) => estate.estateId === estateId && estate.canViewReadings
  );
  return useQuery({
    queryKey: [userId, "reading-assets", estateId, search, page],
    enabled: ready && !!allowed && enabled,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/readings/assets",
        {
          params: {
            path: { estateId },
            query: { search, page, size: READINGS_PAGE_SIZE },
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
