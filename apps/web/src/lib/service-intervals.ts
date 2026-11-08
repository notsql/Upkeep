import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { estateAssetCategoriesQueryKey } from "@/lib/asset-categories";
import { estateError, useEstateSession } from "@/lib/estates";

export type AssetServiceInterval =
  components["schemas"]["AssetServiceIntervalResponse"];
export type ServiceInterval = components["schemas"]["ServiceInterval"];
export type IntervalUnit = ServiceInterval["unit"];

/** Each unit's singular word and largest value (ten years in each unit), as the server accepts. */
export const INTERVAL_UNITS: Record<
  IntervalUnit,
  { label: string; one: string; many: string; max: number }
> = {
  DAY: { label: "Days", one: "day", many: "days", max: 3650 },
  MONTH: { label: "Months", one: "month", many: "months", max: 120 },
  YEAR: { label: "Years", one: "year", many: "years", max: 10 },
};

export function formatInterval(
  interval: ServiceInterval | null | undefined
): string {
  if (!interval) {
    return "Not set";
  }
  const unit = INTERVAL_UNITS[interval.unit];
  return `Every ${interval.value} ${interval.value === 1 ? unit.one : unit.many}`;
}

export function assetServiceIntervalQueryKey(
  userId: string | undefined,
  estateId: string,
  assetId: string
) {
  return [
    "estates",
    userId,
    "assets",
    estateId,
    assetId,
    "service-interval",
  ] as const;
}

export function useSetCategoryServiceInterval(estateId: string) {
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      category,
      interval,
    }: {
      category: string;
      interval: ServiceInterval | null;
    }) => {
      const { data, error, response } = await api.PUT(
        "/estates/{estateId}/asset-categories/{category}/service-interval",
        { params: { path: { estateId, category } }, body: { interval } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: estateAssetCategoriesQueryKey(userId, estateId),
      }),
  });
}

export function useAssetServiceInterval(
  estateId: string,
  assetId: string,
  enabled = true
) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: assetServiceIntervalQueryKey(userId, estateId, assetId),
    enabled: ready && enabled,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/service-interval",
        { params: { path: { estateId, assetId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useSetAssetServiceInterval(estateId: string, assetId: string) {
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (interval: ServiceInterval | null) => {
      const { data, error, response } = await api.PUT(
        "/estates/{estateId}/assets/{assetId}/service-interval",
        { params: { path: { estateId, assetId } }, body: { interval } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: assetServiceIntervalQueryKey(userId, estateId, assetId),
      }),
  });
}
