import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";

export type Asset = components["schemas"]["AssetResponse"];
export type AssetCategory = Asset["category"];
export type AssetInput = components["schemas"]["CreateAssetRequest"];

/** Every category, in the order the form offers them. */
export const assetCategoryLabel: Record<AssetCategory, string> = {
  LIFT: "Lift",
  PUMP: "Pump",
  GENERATOR: "Generator",
  LIGHTING: "Lighting",
  FIRE_SAFETY: "Fire safety",
  HVAC: "HVAC",
  ELECTRICAL: "Electrical",
  OTHER: "Other",
};

export function assetQueryKey(
  userId: string | undefined,
  estateId: string,
  assetId: string
) {
  return ["estates", userId, "assets", estateId, assetId] as const;
}

export function useAsset(estateId: string, assetId: string) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: assetQueryKey(userId, estateId, assetId),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{id}",
        { params: { path: { estateId, id: assetId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useCreateAsset(estateId: string) {
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AssetInput) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/assets",
        { params: { path: { estateId } }, body }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(assetQueryKey(userId, estateId, data.id), data);
    },
  });
}

export function useUpdateAsset(estateId: string, assetId: string) {
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AssetInput) => {
      const { data, error, response } = await api.PATCH(
        "/estates/{estateId}/assets/{id}",
        { params: { path: { estateId, id: assetId } }, body }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(assetQueryKey(userId, estateId, assetId), data);
    },
  });
}

export function useDeactivateAsset(estateId: string, assetId: string) {
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reference: string) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/assets/{id}/deactivate",
        { params: { path: { estateId, id: assetId } }, body: { reference } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(assetQueryKey(userId, estateId, assetId), data);
    },
  });
}
