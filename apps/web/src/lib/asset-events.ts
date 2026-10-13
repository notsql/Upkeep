import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { assetQueryKey } from "@/lib/assets";
import { estateError, useEstateSession } from "@/lib/estates";
import { estateFailureRiskQueryKey } from "@/lib/failure-risk";

export type AssetEvent = components["schemas"]["AssetEventResponse"];
export type AssetEventInput = components["schemas"]["CreateAssetEventRequest"];
export type AssetEventType = AssetEventInput["type"];

export const assetEventTypeLabel: Record<AssetEventType, string> = {
  BREAKDOWN_REPAIR: "Breakdown repair",
  PREVENTIVE: "Preventive maintenance",
};

export function assetEventsQueryKey(
  userId: string | undefined,
  estateId: string,
  assetId: string
) {
  return [...assetQueryKey(userId, estateId, assetId), "events"] as const;
}

export function useAssetEvents(estateId: string, assetId: string) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: assetEventsQueryKey(userId, estateId, assetId),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/events",
        { params: { path: { estateId, assetId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useRecordAssetEvent(estateId: string, assetId: string) {
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AssetEventInput) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/assets/{assetId}/events",
        { params: { path: { estateId, assetId } }, body }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: assetEventsQueryKey(userId, estateId, assetId),
        }),
        queryClient.invalidateQueries({
          queryKey: estateFailureRiskQueryKey(userId, estateId),
        }),
      ]);
    },
  });
}
