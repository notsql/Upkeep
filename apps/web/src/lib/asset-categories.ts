import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";

export type EstateAssetCategory =
  components["schemas"]["EstateAssetCategoryResponse"];

export function estateAssetCategoriesQueryKey(
  userId: string | undefined,
  estateId: string
) {
  return ["estates", userId, "asset-categories", estateId] as const;
}

export function useEstateAssetCategories(estateId: string) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: estateAssetCategoriesQueryKey(userId, estateId),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/asset-categories",
        { params: { path: { estateId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useSetSilentFailure(estateId: string) {
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      category,
      failsSilently,
    }: {
      category: string;
      failsSilently: boolean;
    }) => {
      const { data, error, response } = await api.PUT(
        "/estates/{estateId}/asset-categories/{category}/silent-failure",
        { params: { path: { estateId, category } }, body: { failsSilently } }
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
