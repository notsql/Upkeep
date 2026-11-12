import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ReportRequestError } from "@/lib/estate-reports";
import { type EquipmentType, useRoutingAccess } from "@/lib/report-routing";

export type Contractor = components["schemas"]["ContractorResponse"];
export type ContractorInput = components["schemas"]["ContractorRequest"];

function contractorsKey(userId: string | undefined, estateId: string) {
  return [userId, "estate-contractors", estateId] as const;
}

function message(error: unknown, fallback: string): string {
  return (error as { message?: string } | undefined)?.message ?? fallback;
}

/** The estate's contractor directory; Crew can read it, so it loads for anyone who sees work orders. */
export function useContractors(estateId: string) {
  const { userId, canViewWorkOrders } = useRoutingAccess(estateId);
  return useQuery({
    queryKey: contractorsKey(userId, estateId),
    enabled: canViewWorkOrders,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/contractors",
        { params: { path: { estateId } }, signal }
      );
      if (error || !data) {
        throw new ReportRequestError(
          message(error, "Couldn't load contractors. Try again."),
          response?.status ?? 500
        );
      }
      return data.contractors;
    },
  });
}

function useInvalidateContractors(estateId: string) {
  const { userId } = useRoutingAccess(estateId);
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: contractorsKey(userId, estateId) }),
      client.invalidateQueries({
        queryKey: [userId, "work-orders", estateId, "assignees"],
      }),
    ]);
}

/** Adds a contractor, or edits one when {@code contractorId} is given. */
export function useSaveContractor(estateId: string, contractorId?: string) {
  const invalidate = useInvalidateContractors(estateId);
  return useMutation({
    retry: false,
    mutationFn: async (body: ContractorInput) => {
      const { data, error, response } = contractorId
        ? await api.PUT("/estates/{estateId}/contractors/{contractorId}", {
            params: { path: { estateId, contractorId } },
            body,
          })
        : await api.POST("/estates/{estateId}/contractors", {
            params: { path: { estateId } },
            body,
          });
      if (error || !data) {
        throw new ReportRequestError(
          message(error, "Couldn't save the contractor. Try again."),
          response?.status ?? 500
        );
      }
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useRemoveContractor(estateId: string) {
  const invalidate = useInvalidateContractors(estateId);
  return useMutation({
    retry: false,
    mutationFn: async (contractorId: string) => {
      const { error, response } = await api.DELETE(
        "/estates/{estateId}/contractors/{contractorId}",
        { params: { path: { estateId, contractorId } } }
      );
      if (error) {
        throw new ReportRequestError(
          message(error, "Couldn't remove the contractor. Try again."),
          response?.status ?? 500
        );
      }
    },
    onSuccess: invalidate,
  });
}

/** Sets (or, with null, clears) where new reports of one type of problem go. */
export function useSetDefaultContractor(estateId: string, type: EquipmentType) {
  const invalidate = useInvalidateContractors(estateId);
  return useMutation({
    retry: false,
    mutationFn: async (contractorId: string | null) => {
      const params = { path: { estateId, equipmentType: type } };
      const { error, response } = contractorId
        ? await api.PUT(
            "/estates/{estateId}/contractors/defaults/{equipmentType}",
            {
              params,
              body: { contractorId },
            }
          )
        : await api.DELETE(
            "/estates/{estateId}/contractors/defaults/{equipmentType}",
            { params }
          );
      if (error) {
        throw new ReportRequestError(
          message(error, "Couldn't save the default contractor. Try again."),
          response?.status ?? 500
        );
      }
    },
    onSuccess: invalidate,
  });
}
