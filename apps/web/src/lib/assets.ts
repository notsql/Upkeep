import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dashboardQueryKey } from "@/lib/dashboard";
import { estateError, useEstateSession } from "@/lib/estates";

export type Asset = components["schemas"]["AssetResponse"];
export type AssetInput = components["schemas"]["CreateAssetRequest"];

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
    onSuccess: async (data) => {
      queryClient.setQueryData(assetQueryKey(userId, estateId, data.id), data);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["estates", userId, "assets", estateId],
        }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKey(userId) }),
      ]);
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
    onSuccess: async (data) => {
      queryClient.setQueryData(assetQueryKey(userId, estateId, assetId), data);
      await queryClient.invalidateQueries({
        queryKey: ["estates", userId, "assets", estateId],
      });
    },
  });
}

export function useDeactivateAsset(estateId: string, assetId: string) {
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: components["schemas"]["DeactivateAssetRequest"]
    ) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/assets/{id}/deactivate",
        { params: { path: { estateId, id: assetId } }, body }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(assetQueryKey(userId, estateId, assetId), data);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["estates", userId, "assets", estateId],
        }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKey(userId) }),
      ]);
    },
  });
}

export type AssetFilters = NonNullable<
  import("@proj/api/schema").operations["listAssets"]["parameters"]["query"]
>;

export function useAssets(estateId: string, filters: AssetFilters) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: ["estates", userId, "assets", estateId, "list", filters],
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets",
        { params: { path: { estateId }, query: filters } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useAssetLifecycleEvents(estateId: string, assetId: string) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: [...assetQueryKey(userId, estateId, assetId), "lifecycle"],
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{id}/lifecycle-events",
        { params: { path: { estateId, id: assetId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useRestoreAsset(estateId: string, assetId: string) {
  const { userId } = useEstateSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: components["schemas"]["RestoreAssetRequest"]) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/assets/{id}/restore",
        { params: { path: { estateId, id: assetId } }, body }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: async (data) => {
      client.setQueryData(assetQueryKey(userId, estateId, assetId), data);
      await Promise.all([
        client.invalidateQueries({
          queryKey: ["estates", userId, "assets", estateId],
        }),
        client.invalidateQueries({ queryKey: dashboardQueryKey(userId) }),
      ]);
    },
  });
}

export function useCorrectAssetRetirement(estateId: string, assetId: string) {
  const { userId } = useEstateSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: components["schemas"]["RetirementCorrectionRequest"]
    ) => {
      const { data, error, response } = await api.PATCH(
        "/estates/{estateId}/assets/{id}/retirement",
        { params: { path: { estateId, id: assetId } }, body }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: async (data) => {
      client.setQueryData(assetQueryKey(userId, estateId, assetId), data);
      await client.invalidateQueries({
        queryKey: ["estates", userId, "assets", estateId],
      });
    },
  });
}

export function retirementToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const date = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );
  return `${date.year}-${date.month}-${date.day}`;
}

export function retirementDateError(
  date: string,
  installedOn?: string | null
): string | undefined {
  if (!date) {
    return "Choose a retirement date.";
  }
  const today = retirementToday();
  if (date > today) {
    return `Retirement date cannot be in the future. Today in Singapore is ${today}.`;
  }
  if (installedOn && date < installedOn) {
    return `Retirement date cannot be earlier than the installation date (${installedOn}).`;
  }
  return undefined;
}
