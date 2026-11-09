import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";
import type { FlagReason } from "@/lib/failure-risk";
import {
  type InspectionCheck,
  inspectionListQueryKey,
  useInspectionList,
} from "@/lib/inspection-list";
import { notificationsQueryKey } from "@/lib/notifications";

export type Inspector = components["schemas"]["InspectorResponse"];
export type OpenWorkOrder = components["schemas"]["OpenWorkOrderResponse"];

/** Who the app sends for a warning: crew to look, or a contractor to fix. */
export type DispatchRoute = "CREW" | "CONTRACTOR";

/**
 * The app picks the route from why the equipment was flagged. End of life
 * wins: replacing it makes an inspection pointless.
 */
export function dispatchRoute(reasons: FlagReason[]): DispatchRoute | null {
  if (reasons.includes("END_OF_LIFE")) {
    return "CONTRACTOR";
  }
  return reasons.length ? "CREW" : null;
}

/** An error the send dialog can tell apart by status. */
export class DispatchError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DispatchError";
    this.status = status;
  }
}

export function inspectorsQueryKey(
  userId: string | undefined,
  estateId: string
) {
  return ["estates", userId, "inspectors", estateId] as const;
}

/** Members who can record inspections, sorted by name. */
export function useInspectors(estateId: string, enabled = true) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: inspectorsQueryKey(userId, estateId),
    enabled: ready && enabled,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/inspectors",
        { params: { path: { estateId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

/**
 * The equipment's check that matters for sending crew: this month's, or an
 * open one from earlier. Read from the inspection list senders already load.
 */
export function useAssetCheck(
  estateId: string,
  assetId: string,
  enabled = true
): { check: InspectionCheck | undefined; pending: boolean } {
  const list = useInspectionList(estateId, enabled);
  const checks = list.data?.checks.filter((item) => item.assetId === assetId);
  const check =
    checks?.find((item) => item.status !== "DONE") ??
    checks?.find((item) => item.status === "DONE");
  return { check, pending: enabled && list.isPending };
}

export function useSendCrew(estateId: string, assetId: string) {
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignedToUserId: string) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/assets/{assetId}/inspection-requests",
        {
          params: { path: { estateId, assetId } },
          body: { assignedToUserId },
        }
      );
      if (error || !data) {
        throw new DispatchError(
          estateError(error, response.status).message,
          response.status
        );
      }
      return { check: data, created: response.status === 201 };
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: inspectionListQueryKey(userId, estateId),
        }),
        queryClient.invalidateQueries({
          queryKey: notificationsQueryKey(userId),
        }),
      ]),
  });
}

/** The equipment's work order that isn't closed, or null when there is none. */
export function useOpenWorkOrder(
  estateId: string,
  assetId: string,
  enabled = true
) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: ["estates", userId, "open-work-order", estateId, assetId],
    enabled: ready && enabled,
    retry: false,
    queryFn: async (): Promise<OpenWorkOrder | null> => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/open-work-order",
        { params: { path: { estateId, assetId } } }
      );
      if (response.status === 204) {
        return null;
      }
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}
