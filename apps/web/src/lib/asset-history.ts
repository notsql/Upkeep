import type { components, paths } from "@proj/api/schema";
import {
  type QueryClient,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAppAccess, useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";

export type HistoryEntry = components["schemas"]["AssetHistoryEntryResponse"];
export type HistoryDocument = components["schemas"]["DocumentResponse"];
export type HistoryDateFilters = Pick<
  NonNullable<
    paths["/estates/{estateId}/assets/{assetId}/history"]["get"]["parameters"]["query"]
  >,
  "from" | "to"
>;
export type HistoryAssetFilters = Pick<
  NonNullable<
    paths["/estates/{estateId}/asset-history"]["get"]["parameters"]["query"]
  >,
  "q" | "status" | "cursor"
>;

// Drop old pages after writes so removed/reassociated records cannot survive
// in a loaded tail. The estate prefix covers both old and new asset links.
export function refreshAssetHistory(
  client: QueryClient,
  userId: string | undefined,
  estateId: string
) {
  return client.resetQueries({ queryKey: [userId, "asset-history", estateId] });
}

export class AssetHistoryError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const HISTORY_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u;

function dateBound(value: unknown): string | undefined {
  if (value === undefined) {
    return;
  }
  const message = "Choose valid dates in YYYY-MM-DD format.";
  if (
    typeof value !== "string" ||
    !HISTORY_DATE.test(value) ||
    value.startsWith("0000")
  ) {
    throw new Error(message);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(message);
  }
  return value;
}

export function validateHistoryDates(
  search: Record<string, unknown>
): HistoryDateFilters {
  const from = dateBound(search.from);
  const to = dateBound(search.to);
  if (from && to && from > to) {
    throw new Error("From date must be on or before To date.");
  }
  return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

export function assetHistoryQueryKey(
  userId: string | undefined,
  estateId: string,
  assetId: string,
  filters: HistoryDateFilters
) {
  return [
    userId,
    "asset-history",
    estateId,
    assetId,
    filters.from ?? "",
    filters.to ?? "",
  ] as const;
}

export function useAssetHistoryAccess(estateId: string) {
  const session = useAuthenticatedSession();
  const access = useAppAccess();
  const permission =
    !access.isError && session.ready
      ? access.data?.estates.find((estate) => estate.estateId === estateId)
      : undefined;
  return {
    userId: session.userId,
    pending: !session.ready || access.isPending,
    error: access.error,
    canView: !!permission?.canViewAssetHistory,
    canViewDocuments: !!permission?.canViewDocuments,
    permission,
  };
}

function useHistoryFailure(userId: string | undefined) {
  const client = useQueryClient();
  return (error: unknown, status: number): never => {
    if ([401, 403, 404].includes(status)) {
      client.invalidateQueries({ queryKey: [userId, "app-access"] });
    }
    const message =
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Couldn't load recorded history. Try again.";
    throw new AssetHistoryError(message, status);
  };
}

export function useAssetHistory(
  estateId: string,
  assetId: string,
  filters: HistoryDateFilters = {}
) {
  const access = useAssetHistoryAccess(estateId);
  const fail = useHistoryFailure(access.userId);
  const query = useInfiniteQuery({
    queryKey: assetHistoryQueryKey(access.userId, estateId, assetId, filters),
    enabled: access.canView && !!assetId,
    initialPageParam: undefined as string | undefined,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/history",
        {
          params: {
            path: { estateId, assetId },
            query: { ...filters, cursor: pageParam, limit: 25 },
          },
          signal,
        }
      );
      if (error || !data) {
        return fail(error, response.status);
      }
      return data;
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const denied =
    query.error instanceof AssetHistoryError &&
    [401, 403, 404].includes(query.error.status);
  return {
    ...query,
    data: access.canView && !denied ? query.data : undefined,
    denied,
  };
}

export function useHistoryAssets(
  estateId: string,
  filters: HistoryAssetFilters
) {
  const access = useAssetHistoryAccess(estateId);
  const fail = useHistoryFailure(access.userId);
  const query = useQuery({
    queryKey: [
      access.userId,
      "asset-history",
      estateId,
      "list",
      filters.q ?? "",
      filters.status ?? "ALL",
      filters.cursor,
    ],
    enabled: access.canView,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/asset-history",
        {
          params: { path: { estateId }, query: { ...filters, limit: 25 } },
          signal,
        }
      );
      if (error || !data) {
        return fail(error, response.status);
      }
      return data;
    },
  });
  return {
    ...query,
    data: access.canView && !query.isError ? query.data : undefined,
  };
}

export function useHistoryDocument(
  estateId: string,
  assetId: string,
  documentId: string
) {
  const access = useAssetHistoryAccess(estateId);
  const fail = useHistoryFailure(access.userId);
  return useQuery({
    queryKey: [
      access.userId,
      "asset-history",
      estateId,
      assetId,
      "document",
      documentId,
    ],
    enabled: access.canView && access.canViewDocuments,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/documents/{documentId}/content",
        {
          params: { path: { estateId, documentId } },
          parseAs: "blob",
          signal,
        }
      );
      if (error || !data) {
        return fail(error, response.status);
      }
      return data;
    },
  });
}

export function historyDate(value: string, dateOnly = false): string {
  return (
    new Intl.DateTimeFormat("en-SG", {
      timeZone: "Asia/Singapore",
      day: "numeric",
      month: "short",
      year: "numeric",
      ...(dateOnly
        ? {}
        : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    }).format(new Date(dateOnly ? `${value}T00:00:00+08:00` : value)) +
    (dateOnly ? "" : " SGT")
  );
}
