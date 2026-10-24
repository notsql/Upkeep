import type { components, paths } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppAccess, useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";

export type WorkOrder = components["schemas"]["WorkOrderResponse"];
export type WorkOrderInput = components["schemas"]["CreateWorkOrderRequest"];
export type WorkOrderAssetOption =
  components["schemas"]["WorkOrderAssetOptionResponse"];
type WorkOrderListQuery = NonNullable<
  paths["/estates/{estateId}/work-orders"]["get"]["parameters"]["query"]
>;
export type WorkOrderFilters = Pick<WorkOrderListQuery, "priority" | "q">;
export type WorkOrderListSearch = Omit<WorkOrderListQuery, "limit">;
export class WorkOrderRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export function isSourcePlacementConflict(error: unknown): boolean {
  return (
    error instanceof WorkOrderRequestError &&
    error.status === 409 &&
    error.message.startsWith("The report location changed")
  );
}
export function useWorkOrderAccess(estateId: string) {
  const session = useAuthenticatedSession();
  const access = useAppAccess();
  const permission = access.data?.estates.find(
    (estate) => estate.estateId === estateId
  );
  const valid = session.ready && !access.isError;
  return {
    userId: session.userId,
    canView: valid && !!permission?.canViewWorkOrders,
    canCreate: valid && !!permission?.canCreateWorkOrders,
    canReadReports: valid && !!permission?.canViewFaultReports,
    canViewAssets: valid && !!permission?.canViewAssets,
    canViewManagement: valid && !!permission?.canViewManagement,
    estateName: permission?.estateName,
    pending: !session.ready || access.isPending,
  };
}
function useRequestError(userId: string | undefined) {
  const client = useQueryClient();
  return (message: string, status: number): never => {
    if (status === 401 || status === 403 || status === 404) {
      client.invalidateQueries({ queryKey: [userId, "app-access"] });
    }
    throw new WorkOrderRequestError(message, status);
  };
}
export function useWorkOrderList(
  estateId: string,
  filters: Omit<WorkOrderListSearch, "cursor"> = {},
  cursor?: string
) {
  const { userId, canView } = useWorkOrderAccess(estateId);
  const fail = useRequestError(userId);
  return useQuery<components["schemas"]["WorkOrderPageResponse"]>({
    queryKey: [userId, "work-orders", estateId, "list", filters, cursor],
    enabled: canView,
    retry: false,
    refetchOnWindowFocus: true,
    placeholderData: (previous, previousQuery) => {
      const key = previousQuery?.queryKey;
      const previousOptions = key?.[4] as
        | Omit<WorkOrderListSearch, "cursor">
        | undefined;
      const sameScope = canView && key?.[0] === userId && key?.[2] === estateId;
      const sameFilters =
        previousOptions?.priority === filters.priority &&
        previousOptions?.q === filters.q;
      const sortChanged =
        (previousOptions?.sortBy ?? "CREATED_AT") !==
          (filters.sortBy ?? "CREATED_AT") ||
        (previousOptions?.direction ?? "DESC") !==
          (filters.direction ?? "DESC");
      return sameScope && sameFilters && sortChanged ? previous : undefined;
    },
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/work-orders",
        {
          params: {
            path: { estateId },
            query: { ...filters, cursor, limit: 20 },
          },
          signal,
        }
      );
      if (error || !data) {
        return fail(
          error?.message ?? "Unable to load work orders.",
          response.status
        );
      }
      return data;
    },
  });
}
export function useWorkOrder(estateId: string, workOrderId: string) {
  const { userId, canView } = useWorkOrderAccess(estateId);
  const fail = useRequestError(userId);
  return useQuery({
    queryKey: [userId, "work-orders", estateId, "detail", workOrderId],
    enabled: canView && !!workOrderId,
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/work-orders/{workOrderId}",
        {
          params: { path: { estateId, workOrderId } },
          signal,
        }
      );
      if (error || !data) {
        return fail(
          error?.message ?? "Work order not found or unavailable.",
          response.status
        );
      }
      return data;
    },
  });
}
export function useWorkOrderAssets(
  estateId: string,
  q?: string,
  cursor?: string
) {
  const { userId, canCreate } = useWorkOrderAccess(estateId);
  const fail = useRequestError(userId);
  return useQuery({
    queryKey: [userId, "work-order-assets", estateId, q, cursor],
    enabled: canCreate,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/work-order-assets",
        {
          params: { path: { estateId }, query: { q, cursor, limit: 20 } },
          signal,
        }
      );
      if (error || !data) {
        return fail(
          error?.message ?? "Unable to load asset options.",
          response.status
        );
      }
      return data;
    },
  });
}
export function useCreateWorkOrder(estateId: string) {
  const { userId, canCreate } = useWorkOrderAccess(estateId);
  const client = useQueryClient();
  const fail = useRequestError(userId);
  return useMutation({
    retry: false,
    mutationFn: async (body: WorkOrderInput) => {
      if (!canCreate) {
        return fail("Work-order creation is unavailable.", 403);
      }
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/work-orders",
        {
          params: { path: { estateId } },
          body,
        }
      );
      if (error || !data) {
        return fail(
          error?.message ??
            "Unable to save. Check the work-order list before trying again.",
          response.status
        );
      }
      return data;
    },
    onSuccess: async (data) => {
      client.setQueryData(
        [userId, "work-orders", estateId, "detail", data.id],
        data
      );
      await client.invalidateQueries({
        queryKey: [userId, "work-orders", estateId, "list"],
      });
    },
  });
}
