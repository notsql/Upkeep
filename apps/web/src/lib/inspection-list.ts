import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";

export type InspectionList = components["schemas"]["InspectionListResponse"];
export type InspectionCheck = components["schemas"]["InspectionCheckResponse"];

export function inspectionListQueryKey(
  userId: string | undefined,
  estateId: string
) {
  return ["estates", userId, "inspection-list", estateId] as const;
}

export function useInspectionList(estateId: string) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: inspectionListQueryKey(userId, estateId),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/inspection-list",
        { params: { path: { estateId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useGenerateInspectionList(estateId: string) {
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/inspection-list/generate",
        { params: { path: { estateId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: inspectionListQueryKey(userId, estateId),
      }),
  });
}
