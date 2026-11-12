import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppAccess, useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";
import { ReportRequestError } from "@/lib/estate-reports";

export type EquipmentType =
  components["schemas"]["ContractorResponse"]["defaultFor"][number];
export type ReportRouting = components["schemas"]["ReportRoutingResponse"];
export type RoutingState = ReportRouting["state"];
export type WorkOrderDispatch =
  components["schemas"]["WorkOrderDispatchResponse"];
export type FaultCategory =
  components["schemas"]["ChangeCategoryRequest"]["category"];
export type WorkOrderPriority =
  components["schemas"]["SendToContractorRequest"]["priority"];

export const EQUIPMENT_TYPES: { value: EquipmentType; label: string }[] = [
  { value: "PUMP", label: "Pump" },
  { value: "LIFT", label: "Lift" },
  { value: "GATE", label: "Gate" },
  { value: "LIGHT", label: "Common-area light" },
  { value: "PLUMBING", label: "Plumbing" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "REPAIRS", label: "Painting and repairs" },
  { value: "SECURITY", label: "Security" },
];

/** The kinds of problem a report can be sorted into, in plain words, A to Z with "Something else" last. */
export const FAULT_CATEGORIES: { value: FaultCategory; label: string }[] = [
  { value: "BROKEN_LIGHT", label: "Broken light" },
  { value: "DRAINAGE", label: "Blocked drain" },
  { value: "ROAD_DAMAGE", label: "Damaged road or path" },
  { value: "ILLEGAL_DUMPING", label: "Dumped items" },
  { value: "GRAFFITI", label: "Graffiti or vandalism" },
  { value: "NOISE", label: "Noise" },
  { value: "PARKING", label: "Parking" },
  { value: "RUBBISH", label: "Rubbish or litter" },
  { value: "WATER_LEAK", label: "Water leak" },
  { value: "OTHER", label: "Something else" },
];

/** Which contractor type handles each kind of problem (mirrors the server's FaultCategory). */
export const CATEGORY_CONTRACTOR_TYPE: Record<
  FaultCategory,
  EquipmentType | null
> = {
  WATER_LEAK: "PLUMBING",
  DRAINAGE: "PLUMBING",
  BROKEN_LIGHT: "LIGHT",
  RUBBISH: "CLEANING",
  ILLEGAL_DUMPING: "CLEANING",
  GRAFFITI: "REPAIRS",
  ROAD_DAMAGE: "REPAIRS",
  NOISE: "SECURITY",
  PARKING: "SECURITY",
  OTHER: null,
};

export function categoryLabel(category: FaultCategory): string {
  return (
    FAULT_CATEGORIES.find((item) => item.value === category)?.label ?? category
  );
}

const MISSING_CONTRACTOR = /^No (?<type>\w+) contractor configured\.?$/u;

/** Turns a routing reason from the server into plain words, and names the contractor type it is missing, if any. */
export function explainReason(reason: string): {
  text: string;
  missingContractor: EquipmentType | null;
} {
  const missing = MISSING_CONTRACTOR.exec(reason)?.groups?.type;
  const type = EQUIPMENT_TYPES.find((item) => item.value === missing);
  if (type) {
    return {
      text: `No ${type.label.toLowerCase()} contractor is set up for this estate.`,
      missingContractor: type.value,
    };
  }
  if (reason.startsWith("Confidence below threshold")) {
    return {
      text: "We weren't sure enough what kind of problem this is.",
      missingContractor: null,
    };
  }
  return { text: reason, missingContractor: null };
}

export const ROUTING_STATES: { value: RoutingState; label: string }[] = [
  { value: "CLASSIFYING", label: "Sorting" },
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
          error?.message ?? "Couldn't send the work order. Try again.",
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
          error?.message ?? "Couldn't dismiss the report. Try again.",
          response?.status ?? 500
        );
      }
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Puts the report under another kind of problem (owner or Manager only). Never sends anything by itself. */
export function useChangeCategory(estateId: string, reportId: string) {
  const invalidate = useInvalidateRouting(estateId);
  return useMutation({
    retry: false,
    mutationFn: async (category: FaultCategory) => {
      const { data, error, response } = await api.PUT(
        "/estates/{estateId}/reports/{reportId}/category",
        { params: { path: { estateId, reportId } }, body: { category } }
      );
      if (error || !data) {
        throw new ReportRequestError(
          error?.message ?? "Couldn't change the type. Try again.",
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
          error?.message ?? "Couldn't load the contractor email. Try again.",
          response?.status ?? 500
        );
      }
      return data.dispatch ?? null;
    },
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
          error?.message ?? "Couldn't resend the contractor email. Try again.",
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
