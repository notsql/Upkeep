import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ReportRequestError } from "@/lib/estate-reports";
import { type EquipmentType, useRoutingAccess } from "@/lib/report-routing";

export type Contractor = components["schemas"]["EquipmentContractorResponse"];

export function useContractors(estateId: string) {
  const { userId, canManage } = useRoutingAccess(estateId);
  return useQuery({
    queryKey: [userId, "estate-contractors", estateId],
    enabled: canManage,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/contractors",
        { params: { path: { estateId } }, signal }
      );
      if (error || !data) {
        throw new ReportRequestError(
          error?.message ?? "Unable to load contractors.",
          response?.status ?? 500
        );
      }
      return data;
    },
  });
}

export function useSaveContractor(estateId: string, type: EquipmentType) {
  const { userId } = useRoutingAccess(estateId);
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (
      body: components["schemas"]["EquipmentContractorRequest"]
    ) => {
      const { data, error, response } = await api.PUT(
        "/estates/{estateId}/contractors/{equipmentType}",
        { params: { path: { estateId, equipmentType: type } }, body }
      );
      if (error || !data) {
        throw new ReportRequestError(
          error?.message ?? "Unable to save the contractor.",
          response?.status ?? 500
        );
      }
      return data;
    },
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: [userId, "estate-contractors", estateId],
      }),
  });
}

export function useRemoveContractor(estateId: string, type: EquipmentType) {
  const { userId } = useRoutingAccess(estateId);
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async () => {
      const { error, response } = await api.DELETE(
        "/estates/{estateId}/contractors/{equipmentType}",
        { params: { path: { estateId, equipmentType: type } } }
      );
      if (error) {
        throw new ReportRequestError(
          error.message ?? "Unable to remove the contractor.",
          response?.status ?? 500
        );
      }
    },
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: [userId, "estate-contractors", estateId],
      }),
  });
}
