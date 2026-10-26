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
export type WorkOrderFilters = Pick<
  WorkOrderListQuery,
  "priority" | "q" | "status" | "category"
>;
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
    canUpdate: valid && !!permission?.canUpdateWorkOrders,
    canReadReports: valid && !!permission?.canViewFaultReports,
    canViewAssets: valid && !!permission?.canViewAssets,
    canViewDocuments: valid && !!permission?.canViewDocuments,
    canViewManagement: valid && !!permission?.canViewManagement,
    canViewEstateDetails:
      valid &&
      !!(permission?.canViewEstateDetails ?? permission?.canViewManagement),
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
        previousOptions?.status === filters.status &&
        previousOptions?.category === filters.category &&
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
      if (data.sourceInspectionId && data.assetId) {
        await Promise.all([
          client.invalidateQueries({
            queryKey: [userId, "inspection-results", estateId, data.assetId],
          }),
          client.invalidateQueries({
            queryKey: [
              userId,
              "inspection-source",
              estateId,
              data.sourceInspectionId,
            ],
          }),
        ]);
      }
    },
  });
}

export type WorkOrderCompletionInput =
  components["schemas"]["SaveWorkOrderCompletionRequest"];
export type WorkOrderCompletion =
  components["schemas"]["WorkOrderCompletionResponse"];
export type WorkOrderStatusInput =
  components["schemas"]["ChangeWorkOrderStatusRequest"];

export function useWorkOrderStatusHistory(
  estateId: string,
  workOrderId: string
) {
  const { userId, canView } = useWorkOrderAccess(estateId);
  const fail = useRequestError(userId);
  return useQuery({
    queryKey: [userId, "work-orders", estateId, "history", workOrderId],
    enabled: canView && !!workOrderId,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/work-orders/{workOrderId}/status-history",
        { params: { path: { estateId, workOrderId } }, signal }
      );
      if (error || !data) {
        return fail(
          error?.message ?? "Unable to load status history.",
          response.status
        );
      }
      return data;
    },
  });
}

export function useAssetWorkOrderCompletions(
  estateId: string,
  assetId: string
) {
  const { userId, canViewAssets } = useWorkOrderAccess(estateId);
  const fail = useRequestError(userId);
  const query = useQuery({
    queryKey: [userId, "asset-work-order-completions", estateId, assetId],
    enabled: canViewAssets && !!assetId,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/work-order-completions",
        { params: { path: { estateId, assetId } }, signal }
      );
      if (error || !data) {
        return fail(
          error?.message ?? "Unable to load completed work orders.",
          response.status
        );
      }
      return data;
    },
  });
  return {
    ...query,
    data: canViewAssets && !query.isError ? query.data : undefined,
  };
}

function useProgressSuccess(estateId: string) {
  const { userId } = useWorkOrderAccess(estateId);
  const client = useQueryClient();
  return async (data: WorkOrder) => {
    client.setQueryData(
      [userId, "work-orders", estateId, "detail", data.id],
      data
    );
    await Promise.all([
      client.invalidateQueries({
        queryKey: [userId, "work-orders", estateId, "list"],
      }),
      client.invalidateQueries({
        queryKey: [userId, "work-orders", estateId, "history", data.id],
      }),
      client.invalidateQueries({
        queryKey: [userId, "work-orders", estateId, "revisions", data.id],
      }),
      ...(data.assetId && data.completion
        ? [
            client.invalidateQueries({
              queryKey: [
                userId,
                "asset-work-order-completions",
                estateId,
                data.assetId,
              ],
            }),
          ]
        : []),
    ]);
  };
}

export function useChangeWorkOrderStatus(
  estateId: string,
  workOrderId: string
) {
  const { userId, canUpdate } = useWorkOrderAccess(estateId);
  const fail = useRequestError(userId);
  const onSuccess = useProgressSuccess(estateId);
  return useMutation({
    retry: false,
    onSuccess,
    mutationFn: async (body: WorkOrderStatusInput) => {
      if (!canUpdate) {
        return fail("Work-order updates are unavailable.", 403);
      }
      const { data, error, response } = await api.PATCH(
        "/estates/{estateId}/work-orders/{workOrderId}/status",
        { params: { path: { estateId, workOrderId } }, body }
      );
      if (error || !data) {
        return fail(
          error?.message ??
            "Unable to start work. Refresh to check its status before retrying.",
          response.status
        );
      }
      return data;
    },
  });
}

export function useSaveWorkOrderCompletion(
  estateId: string,
  workOrderId: string
) {
  const { userId, canUpdate } = useWorkOrderAccess(estateId);
  const fail = useRequestError(userId);
  const onSuccess = useProgressSuccess(estateId);
  return useMutation({
    retry: false,
    onSuccess,
    mutationFn: async (body: WorkOrderCompletionInput) => {
      if (!canUpdate) {
        return fail("Work-order completion is unavailable.", 403);
      }
      const { data, error, response } = await api.PUT(
        "/estates/{estateId}/work-orders/{workOrderId}/completion",
        { params: { path: { estateId, workOrderId } }, body }
      );
      if (error || !data) {
        return fail(
          error?.message ??
            "Unable to save completion. Refresh to check whether it was saved before retrying.",
          response.status
        );
      }
      return data;
    },
  });
}

export type WorkOrderCorrectionInput =
  components["schemas"]["CorrectWorkOrderCompletionRequest"];
export type WorkOrderCompletionRevision =
  components["schemas"]["WorkOrderCompletionRevisionResponse"];

export function useWorkOrderCompletionRevisions(
  estateId: string,
  workOrderId: string,
  enabled: boolean
) {
  const { userId, canView } = useWorkOrderAccess(estateId);
  const fail = useRequestError(userId);
  return useQuery({
    queryKey: [userId, "work-orders", estateId, "revisions", workOrderId],
    enabled: canView && enabled && !!workOrderId,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/work-orders/{workOrderId}/completion-revisions",
        {
          params: { path: { estateId, workOrderId } },
          signal,
        }
      );
      if (error || !data) {
        return fail(
          error?.message ?? "Unable to load outcome corrections.",
          response.status
        );
      }
      return data;
    },
  });
}

export function useCorrectWorkOrderCompletion(
  estateId: string,
  workOrderId: string
) {
  const { userId, canUpdate } = useWorkOrderAccess(estateId);
  const fail = useRequestError(userId);
  const onSuccess = useProgressSuccess(estateId);
  return useMutation({
    retry: false,
    onSuccess,
    mutationFn: async (body: WorkOrderCorrectionInput) => {
      if (!canUpdate) {
        return fail("Outcome corrections are unavailable.", 403);
      }
      const { data, error, response } = await api.PATCH(
        "/estates/{estateId}/work-orders/{workOrderId}/completion",
        {
          params: { path: { estateId, workOrderId } },
          body,
        }
      );
      if (error || !data) {
        return fail(
          error?.message ??
            "Unable to save the correction. Refresh before retrying.",
          response.status
        );
      }
      return data;
    },
  });
}
