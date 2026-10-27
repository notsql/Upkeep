import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppAccess, useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";
import { ReportRequestError } from "@/lib/estate-reports";

export type EquipmentType =
  components["schemas"]["EquipmentContractorResponse"]["equipmentType"];
export type ReportRouting = components["schemas"]["ReportRoutingResponse"];
export type RoutingState = ReportRouting["state"];
export type WorkOrderDispatch =
  components["schemas"]["WorkOrderDispatchResponse"];
export type WorkOrderPriority =
  components["schemas"]["SendToContractorRequest"]["priority"];

export const EQUIPMENT_TYPES: { value: EquipmentType; label: string }[] = [
  { value: "PUMP", label: "Pump" },
  { value: "LIFT", label: "Lift" },
  { value: "GATE", label: "Gate" },
  { value: "LIGHT", label: "Common-area light" },
];

export const ROUTING_STATES: { value: RoutingState; label: string }[] = [
  { value: "CLASSIFYING", label: "Classifying" },
  { value: "NEEDS_REVIEW", label: "Needs review" },
  { value: "WORK_ORDER", label: "Work order created" },
  { value: "DISMISSED", label: "Dismissed" },
];

export const PRIORITIES: { value: WorkOrderPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export function equipmentLabel(type: EquipmentType): string {
  return EQUIPMENT_TYPES.find((item) => item.value === type)?.label ?? type;
}

export function routingStateLabel(state: RoutingState): string {
  return ROUTING_STATES.find((item) => item.value === state)?.label ?? state;
}

/** Routing decisions and contractor settings belong to work-order creators (ID-36: owner or Manager). */
export function useRoutingAccess(estateId: string) {
  const access = useAppAccess();
  const { userId, ready } = useAuthenticatedSession();
  const permission = access.data?.estates.find(
    (estate) => estate.estateId === estateId
  );
  return {
    userId,
    canManage: ready && !access.isError && !!permission?.canCreateWorkOrders,
    canViewWorkOrders:
      ready && !access.isError && !!permission?.canViewWorkOrders,
    pending: !ready || access.isPending,
  };
}

function useInvalidateRouting(estateId: string) {
  const { userId } = useRoutingAccess(estateId);
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({
        queryKey: [userId, "estate-reports", estateId],
      }),
      client.invalidateQueries({ queryKey: [userId, "work-orders", estateId] }),
    ]);
}

export function useSendToContractor(estateId: string, reportId: string) {
  const invalidate = useInvalidateRouting(estateId);
  return useMutation({
    retry: false,
    mutationFn: async (
      body: components["schemas"]["SendToContractorRequest"]
    ) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/reports/{reportId}/work-order",
        { params: { path: { estateId, reportId } }, body }
      );
      if (error || !data) {
        throw new ReportRequestError(
          error?.message ?? "Unable to send the work order.",
          response?.status ?? 500
        );
      }
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useDismissReport(estateId: string, reportId: string) {
  const invalidate = useInvalidateRouting(estateId);
  return useMutation({
    retry: false,
    mutationFn: async () => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/reports/{reportId}/dismiss",
        { params: { path: { estateId, reportId } } }
      );
      if (error || !data) {
        throw new ReportRequestError(
          error?.message ?? "Unable to dismiss the report.",
          response?.status ?? 500
        );
      }
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useWorkOrderDispatch(estateId: string, workOrderId: string) {
  const { userId, canViewWorkOrders } = useRoutingAccess(estateId);
  return useQuery({
    queryKey: [userId, "work-orders", estateId, "dispatch", workOrderId],
    enabled: canViewWorkOrders && !!workOrderId,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/work-orders/{workOrderId}/dispatch",
        { params: { path: { estateId, workOrderId } }, signal }
      );
      if (error || !data) {
        throw new ReportRequestError(
          error?.message ?? "Unable to load the contractor email.",
          response?.status ?? 500
        );
      }
      return data.dispatch ?? null;
    },
  });
}

export function useDispatchWorkOrder(estateId: string, workOrderId: string) {
  const invalidate = useInvalidateRouting(estateId);
  return useMutation({
    retry: false,
    mutationFn: async (equipmentType: EquipmentType) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/work-orders/{workOrderId}/dispatch",
        {
          params: { path: { estateId, workOrderId } },
          body: { equipmentType },
        }
      );
      if (error || !data) {
        throw new ReportRequestError(
          error?.message ?? "Unable to email the contractor.",
          response?.status ?? 500
        );
      }
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useRetryDispatch(estateId: string) {
  const invalidate = useInvalidateRouting(estateId);
  return useMutation({
    retry: false,
    mutationFn: async (workOrderId: string) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/work-orders/{workOrderId}/dispatch/retry",
        { params: { path: { estateId, workOrderId } } }
      );
      if (error || !data) {
        throw new ReportRequestError(
          error?.message ?? "Unable to retry the contractor email.",
          response?.status ?? 500
        );
      }
      return data;
    },
    onSuccess: invalidate,
  });
}

const WORK_ORDER_STATUSES: Record<
  NonNullable<ReportRouting["workOrder"]>["status"],
  string
> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  CLOSED: "Closed",
};

export function workOrderStatusLabel(
  status: NonNullable<ReportRouting["workOrder"]>["status"]
): string {
  return WORK_ORDER_STATUSES[status] ?? status;
}

export function dispatchStatusLabel(dispatch: WorkOrderDispatch): string {
  if (dispatch.status === "SENT" && dispatch.sentAt) {
    return `Sent ${new Date(dispatch.sentAt).toLocaleString()}`;
  }
  return dispatch.status === "FAILED" ? "Failed to send" : "Sending";
}
