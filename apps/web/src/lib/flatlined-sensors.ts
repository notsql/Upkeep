import type { components, paths } from "@proj/api/schema";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";
import { estateError } from "@/lib/estates";

export type SensorReview = components["schemas"]["FlatlineReviewResponse"];
export type SensorPolicy = components["schemas"]["FlatlinePolicyResponse"];
export type MonitoredSensor = components["schemas"]["SensorMonitoringResponse"];
export type SensorView = NonNullable<
  NonNullable<
    paths["/estates/{estateId}/flatlined-sensors"]["get"]["parameters"]["query"]
  >["view"]
>;

export function flatlineQueryKey(userId: string | undefined, estateId: string) {
  return [userId, "flatline", estateId] as const;
}

export function useFlatlinePolicies(estateId: string) {
  const { userId, ready } = useAuthenticatedSession();
  return useQuery({
    queryKey: [...flatlineQueryKey(userId, estateId), "policies"],
    enabled: ready,
    retry: false,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/flatline-policies",
        { params: { path: { estateId } }, signal }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

function flatlineReviewQuery(
  userId: string | undefined,
  ready: boolean,
  estateId: string,
  view: SensorView,
  page: number
) {
  return {
    queryKey: [...flatlineQueryKey(userId, estateId), "review", view, page, 25],
    enabled: ready,
    retry: false,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/flatlined-sensors",
        {
          params: { path: { estateId }, query: { view, page, size: 25 } },
          signal,
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  };
}

export function useFlatlineReview(
  estateId: string,
  view: SensorView,
  page: number
) {
  const { userId, ready } = useAuthenticatedSession();
  return useQuery(flatlineReviewQuery(userId, ready, estateId, view, page));
}

/**
 * Every page of the review: page 0 first, then the rest once its total is
 * known. Entries are concatenated, dropping duplicates by device and metric
 * (pages fetched separately can shift between requests).
 */
export function useAllFlatlineReview(estateId: string, view: SensorView) {
  const { userId, ready } = useAuthenticatedSession();
  const first = useQuery(flatlineReviewQuery(userId, ready, estateId, view, 0));
  const pages = first.data
    ? Math.ceil(first.data.totalElements / first.data.size)
    : 0;
  const rest = useQueries({
    queries: Array.from({ length: Math.max(pages - 1, 0) }, (_, index) =>
      flatlineReviewQuery(userId, ready, estateId, view, index + 1)
    ),
  });
  const results = [first, ...rest];
  const seen = new Set<string>();
  const sensors: MonitoredSensor[] = [];
  for (const result of results) {
    for (const sensor of result.data?.sensors ?? []) {
      const key = `${sensor.deviceId}:${sensor.metric}`;
      if (!seen.has(key)) {
        seen.add(key);
        sensors.push(sensor);
      }
    }
  }
  const failed = results.find((result) => result.error);
  const client = useQueryClient();
  const refetch = useCallback(
    () =>
      client.refetchQueries({
        queryKey: [...flatlineQueryKey(userId, estateId), "review", view],
      }),
    [client, estateId, userId, view]
  );
  return {
    canManage: Boolean(first.data?.canManage && first.data.estateActive),
    error: failed?.error ?? null,
    isPending: results.some((result) => result.isPending),
    refetch,
    sensors,
  };
}

export function useSetFlatlinePolicy(
  estateId: string,
  metric: SensorPolicy["metric"]
) {
  const { userId } = useAuthenticatedSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: components["schemas"]["SetFlatlinePolicyRequest"]
    ) => {
      const { data, error, response } = await api.PUT(
        "/estates/{estateId}/flatline-policies/{metric}",
        {
          params: { path: { estateId, metric } },
          body,
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: flatlineQueryKey(userId, estateId),
      });
    },
  });
}

export function usePauseFlatlineSensor(
  estateId: string,
  sensor: MonitoredSensor
) {
  const { userId } = useAuthenticatedSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: components["schemas"]["CreateFlatlinePauseRequest"]
    ) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/devices/{deviceId}/flatline-pauses/{metric}",
        {
          params: {
            path: {
              estateId,
              deviceId: sensor.deviceId,
              metric: sensor.metric,
            },
          },
          body,
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: flatlineQueryKey(userId, estateId),
      });
    },
  });
}
