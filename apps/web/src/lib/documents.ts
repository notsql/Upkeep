import type { components, paths } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppAccess, useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";

export type EstateDocument = components["schemas"]["DocumentResponse"];
export type DocumentType = EstateDocument["documentType"];
export type DocumentFilters = NonNullable<
  paths["/estates/{estateId}/documents"]["get"]["parameters"]["query"]
>;

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

export function useDocuments(estateId: string, filters: DocumentFilters) {
  const { userId, ready } = useAuthenticatedSession();
  const access = useDocumentAccess(estateId);
  return useQuery({
    queryKey: [userId, "documents", estateId, filters],
    enabled: ready && access.canView,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET("/estates/{estateId}/documents", {
        params: { path: { estateId }, query: filters },
        signal,
      });
      if (error || !data) {
        throw documentError(error, "Unable to load documents. Try again.");
      }
      return data;
    },
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
          "Unable to upload the file. Check the document list before retrying."
        );
      }
      return result.data;
    },
    onSuccess: () => {
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
        throw documentError(error, "Unable to remove the file. Please retry.");
      }
    },
    onSuccess: () => {
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
        throw documentError(
          error,
          "Unable to download the file. Please retry."
        );
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
        URL.revokeObjectURL(url);
      }
    },
  });
}
