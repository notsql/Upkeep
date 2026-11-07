import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";
import { useDocumentAccess } from "@/lib/documents";
import { useEstate } from "@/lib/estates";

export type DocumentAsset = components["schemas"]["DocumentAssetResponse"];
export type DocumentAssetInput =
  components["schemas"]["ChangeDocumentAssetRequest"];

export class AssetDocumentError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function useAssetDocumentAccess(estateId: string) {
  const session = useAuthenticatedSession();
  const documents = useDocumentAccess(estateId);
  const canReadAssets = session.ready && !!documents.permission?.canViewAssets;
  const estate = useEstate(canReadAssets ? estateId : undefined);
  return {
    userId: session.userId,
    pending: !session.ready || documents.pending || estate.isPending,
    canRead: canReadAssets && documents.canView && !estate.isError,
    canWrite:
      canReadAssets &&
      !!estate.data?.owned &&
      !estate.data.deactivatedAt &&
      !estate.isError,
  };
}

function associationKey(
  userId: string | undefined,
  estateId: string,
  documentId: string
) {
  return [userId, "documents", estateId, "asset-association", documentId];
}

function useFailure(userId: string | undefined) {
  const client = useQueryClient();
  return (error: { message?: string } | undefined, status: number): never => {
    if ([401, 403, 404].includes(status)) {
      client.invalidateQueries({ queryKey: [userId, "app-access"] });
    }
    throw new AssetDocumentError(
      error?.message ??
        "Unable to save or load the asset link. Refresh before retrying.",
      status
    );
  };
}

export function useDocumentAsset(estateId: string, documentId: string) {
  const access = useAssetDocumentAccess(estateId);
  const fail = useFailure(access.userId);
  const query = useQuery({
    queryKey: associationKey(access.userId, estateId, documentId),
    enabled: access.canRead && !!documentId,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/documents/{documentId}/asset",
        {
          params: { path: { estateId, documentId } },
          signal,
        }
      );
      if (error || !data) {
        return fail(error, response.status);
      }
      return data;
    },
  });
  return {
    ...query,
    data: access.canRead && !query.isError ? query.data : undefined,
  };
}

export function useAssetDocuments(
  estateId: string,
  assetId: string,
  cursor?: string
) {
  const access = useAssetDocumentAccess(estateId);
  const fail = useFailure(access.userId);
  const query = useQuery({
    queryKey: [
      access.userId,
      "documents",
      estateId,
      "asset-attachments",
      assetId,
      cursor,
    ],
    enabled: access.canRead,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/documents",
        {
          params: { path: { estateId, assetId }, query: { cursor } },
          signal,
        }
      );
      if (error || !data) {
        return fail(error, response.status);
      }
      return data;
    },
  });
  return {
    ...query,
    data: access.canRead && !query.isError ? query.data : undefined,
  };
}

export function useChangeDocumentAsset(estateId: string, documentId: string) {
  const access = useAssetDocumentAccess(estateId);
  const client = useQueryClient();
  const fail = useFailure(access.userId);
  return useMutation({
    retry: false,
    mutationFn: async (body: DocumentAssetInput) => {
      if (!access.canWrite) {
        throw new AssetDocumentError(
          "Asset link changes are unavailable.",
          403
        );
      }
      const { data, error, response } = await api
        .PUT("/estates/{estateId}/documents/{documentId}/asset", {
          params: { path: { estateId, documentId } },
          body,
        })
        .catch(() => {
          throw new AssetDocumentError(
            "Link save could not be confirmed. Refresh the asset link before retrying.",
            0
          );
        });
      if (error || !data) {
        return fail(error, response.status);
      }
      return data;
    },
    onSuccess: (data) => {
      client.setQueryData(
        associationKey(access.userId, estateId, documentId),
        data
      );
      client.invalidateQueries({
        queryKey: [access.userId, "documents", estateId],
      });
    },
  });
}
