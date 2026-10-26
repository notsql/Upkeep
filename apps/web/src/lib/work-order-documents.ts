import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";
import { useDocumentAccess } from "@/lib/documents";

export type DocumentAssociation =
  components["schemas"]["DocumentWorkOrderResponse"];
export type DocumentAssociationInput =
  components["schemas"]["ChangeDocumentWorkOrderRequest"];

export class DocumentAssociationError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export function useWorkOrderDocumentAccess(estateId: string) {
  const session = useAuthenticatedSession();
  const access = useDocumentAccess(estateId);
  const canRead =
    session.ready && access.canView && !!access.permission?.canViewWorkOrders;
  return {
    userId: session.userId,
    pending: !session.ready || access.pending,
    canRead,
    canWrite:
      canRead &&
      !!access.permission?.canUpdateWorkOrders &&
      !!access.permission?.canUploadDocuments,
  };
}
function associationKey(
  userId: string | undefined,
  estateId: string,
  documentId: string
) {
  return [userId, "documents", estateId, "association", documentId];
}
function useAssociationFailure(userId: string | undefined) {
  const client = useQueryClient();
  return (error: { message?: string } | undefined, status: number): never => {
    if (status === 401 || status === 403 || status === 404) {
      client.invalidateQueries({ queryKey: [userId, "app-access"] });
    }
    throw new DocumentAssociationError(
      error?.message ??
        "Unable to save or load the document link. Refresh before retrying.",
      status
    );
  };
}
export function useDocumentAssociation(estateId: string, documentId: string) {
  const access = useWorkOrderDocumentAccess(estateId);
  const fail = useAssociationFailure(access.userId);
  return useQuery({
    queryKey: associationKey(access.userId, estateId, documentId),
    enabled: access.canRead,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/documents/{documentId}/work-order",
        { params: { path: { estateId, documentId } }, signal }
      );
      if (error || !data) {
        return fail(error, response.status);
      }
      return data;
    },
  });
}
export function useDocumentAssociationHistory(
  estateId: string,
  documentId: string,
  cursor?: string
) {
  const access = useWorkOrderDocumentAccess(estateId);
  const fail = useAssociationFailure(access.userId);
  return useQuery({
    queryKey: [
      access.userId,
      "documents",
      estateId,
      "association-history",
      documentId,
      cursor,
    ],
    enabled: access.canRead,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/documents/{documentId}/work-order/history",
        {
          params: { path: { estateId, documentId }, query: { cursor } },
          signal,
        }
      );
      if (error || !data) {
        return fail(error, response.status);
      }
      return data;
    },
  });
}
export function useWorkOrderDocuments(
  estateId: string,
  workOrderId: string,
  cursor?: string
) {
  const access = useWorkOrderDocumentAccess(estateId);
  const fail = useAssociationFailure(access.userId);
  return useQuery({
    queryKey: [
      access.userId,
      "documents",
      estateId,
      "work-order-attachments",
      workOrderId,
      cursor,
    ],
    enabled: access.canRead,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/work-orders/{workOrderId}/documents",
        {
          params: { path: { estateId, workOrderId }, query: { cursor } },
          signal,
        }
      );
      if (error || !data) {
        return fail(error, response.status);
      }
      return data;
    },
  });
}
export function useChangeDocumentAssociation(
  estateId: string,
  documentId: string
) {
  const access = useWorkOrderDocumentAccess(estateId);
  const client = useQueryClient();
  const fail = useAssociationFailure(access.userId);
  return useMutation({
    retry: false,
    mutationFn: async ({
      body,
    }: {
      body: DocumentAssociationInput;
      previousWorkOrderId?: string | null;
    }) => {
      if (!access.canWrite) {
        throw new DocumentAssociationError(
          "Document link changes are unavailable.",
          403
        );
      }
      const { data, error, response } = await api
        .PUT("/estates/{estateId}/documents/{documentId}/work-order", {
          params: { path: { estateId, documentId } },
          body,
        })
        .catch(() => {
          throw new DocumentAssociationError(
            "Link save could not be confirmed. Refresh the document link before retrying.",
            0
          );
        });
      if (error || !data) {
        return fail(error, response.status);
      }
      return data;
    },
    onSuccess: (data, variables) => {
      client.setQueryData(
        associationKey(access.userId, estateId, documentId),
        data
      );
      client.invalidateQueries({
        queryKey: [
          access.userId,
          "documents",
          estateId,
          "association-history",
          documentId,
        ],
      });
      for (const id of new Set([
        variables.previousWorkOrderId,
        data.workOrderId,
      ])) {
        if (id) {
          client.invalidateQueries({
            queryKey: [
              access.userId,
              "documents",
              estateId,
              "work-order-attachments",
              id,
            ],
          });
        }
      }
    },
  });
}
