import type { components, paths } from "@proj/api/schema";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAppAccess, useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";
import { refreshAssetHistory } from "@/lib/asset-history";

export type EstateDocument = components["schemas"]["DocumentResponse"];
export type DocumentType = EstateDocument["documentType"];
export type DocumentFilters = NonNullable<
  paths["/estates/{estateId}/documents"]["get"]["parameters"]["query"]
>;

const OBJECT_URL_LIFETIME = 1000;

function documentError(error: unknown, fallback: string): Error {
  return new Error(
    error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
      ? error.message
      : fallback
  );
}

export function useDocumentAccess(estateId: string) {
  const access = useAppAccess();
  const permission = access.isError
    ? undefined
    : access.data?.estates.find((estate) => estate.estateId === estateId);
  return {
    pending: access.isPending,
    permission,
    canView: !!permission?.canViewDocuments,
  };
}

export function useDocuments(
  estateId: string,
  filters: DocumentFilters,
  enabled = true
) {
  const { userId, ready } = useAuthenticatedSession();
  const access = useDocumentAccess(estateId);
  return useQuery({
    queryKey: [userId, "documents", estateId, filters],
    enabled: ready && access.canView && enabled,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET("/estates/{estateId}/documents", {
        params: { path: { estateId }, query: filters },
        signal,
      });
      if (error || !data) {
        throw documentError(error, "Couldn't load documents. Try again.");
      }
      return data;
    },
  });
}

/** The same list as `useDocuments`, page after page, for phone widths. */
export function useDocumentFeed(
  estateId: string,
  filters: Omit<DocumentFilters, "cursor">,
  enabled: boolean
) {
  const { userId, ready } = useAuthenticatedSession();
  const access = useDocumentAccess(estateId);
  return useInfiniteQuery({
    queryKey: [userId, "documents", estateId, "feed", filters],
    enabled: ready && access.canView && enabled,
    retry: false,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({
      pageParam,
      signal,
    }): Promise<components["schemas"]["DocumentPageResponse"]> => {
      const { data, error } = await api.GET("/estates/{estateId}/documents", {
        params: {
          path: { estateId },
          query: { ...filters, cursor: pageParam },
        },
        signal,
      });
      if (error || !data) {
        throw documentError(error, "Couldn't load documents. Try again.");
      }
      return data;
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function useUploadDocument(estateId: string) {
  const { userId } = useAuthenticatedSession();
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async ({
      documentType,
      file,
    }: {
      documentType: DocumentType;
      file: File;
    }) => {
      const body = new FormData();
      body.append("documentType", documentType);
      body.append("file", file);
      const result = await api
        .POST("/estates/{estateId}/documents", {
          params: { path: { estateId } },
          body: body as never,
        })
        .catch((cause: unknown) => {
          throw new Error(
            "Upload completion could not be confirmed. Refresh the document list before retrying.",
            { cause }
          );
        });
      if (result.error || !result.data || result.response.status !== 201) {
        throw documentError(
          result.error,
          "Couldn't upload the file. Check the document list before you try again."
        );
      }
      return result.data;
    },
    onSuccess: async () => {
      await refreshAssetHistory(client, userId, estateId);
      client.invalidateQueries(
        { queryKey: [userId, "documents", estateId] },
        { throwOnError: false }
      );
    },
  });
}

export function useDeleteDocument(estateId: string) {
  const { userId } = useAuthenticatedSession();
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (documentId: string) => {
      const { error, response } = await api.DELETE(
        "/estates/{estateId}/documents/{documentId}",
        {
          params: { path: { estateId, documentId } },
        }
      );
      if (error || response.status !== 204) {
        throw documentError(error, "Couldn't remove the file. Try again.");
      }
    },
    onSuccess: async () => {
      await refreshAssetHistory(client, userId, estateId);
      client.invalidateQueries(
        { queryKey: [userId, "documents", estateId] },
        { throwOnError: false }
      );
    },
  });
}

export function useDownloadDocument(estateId: string) {
  return useMutation({
    retry: false,
    mutationFn: async (document: EstateDocument) => {
      const { data, error } = await api.GET(
        "/estates/{estateId}/documents/{documentId}/content",
        {
          params: { path: { estateId, documentId: document.id } },
          parseAs: "blob",
        }
      );
      if (error || !data) {
        throw documentError(error, "Couldn't download the file. Try again.");
      }
      const url = URL.createObjectURL(data);
      const link = window.document.createElement("a");
      try {
        link.href = url;
        link.download = document.originalFilename;
        window.document.body.append(link);
        link.click();
      } finally {
        link.remove();
        // Safari cancels the save if the URL is revoked in the same task as
        // the click, so release it once the download has started.
        window.setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME);
      }
    },
  });
}
