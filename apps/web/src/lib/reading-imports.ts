import type { components } from "@proj/api/schema";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";

export type ReadingImportOptions =
  components["schemas"]["ReadingImportOptions"];
export type ReadingImportBatch =
  components["schemas"]["ReadingImportBatchResponse"];
export type ReadingImportRow =
  components["schemas"]["ReadingImportRowResponse"];
export type ReadingImportOutcome = ReadingImportRow["outcome"];

export function useReadingImports(
  estateId: string,
  page: number,
  enabled: boolean
) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: [userId, "reading-imports", estateId, "list", page],
    enabled: ready && enabled,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/readings/imports",
        { signal, params: { path: { estateId }, query: { page, size: 50 } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}
function nextOffsetPage(page: {
  page: number;
  size: number;
  totalItems: number;
}) {
  return (page.page + 1) * page.size < page.totalItems
    ? page.page + 1
    : undefined;
}

/** The same list as `useReadingImports`, page after page, for phones. */
export function useReadingImportFeed(estateId: string, enabled: boolean) {
  const { userId, ready } = useEstateSession();
  return useInfiniteQuery({
    queryKey: [userId, "reading-imports", estateId, "feed"],
    enabled: ready && enabled,
    retry: false,
    initialPageParam: 0,
    queryFn: async ({
      pageParam,
      signal,
    }): Promise<components["schemas"]["ReadingImportBatchPage"]> => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/readings/imports",
        {
          signal,
          params: { path: { estateId }, query: { page: pageParam, size: 50 } },
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    getNextPageParam: nextOffsetPage,
  });
}
export function useReadingImport(
  estateId: string,
  batchId: string,
  enabled: boolean
) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: [userId, "reading-imports", estateId, batchId],
    enabled: ready && enabled,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/readings/imports/{batchId}",
        { signal, params: { path: { estateId, batchId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}
export function useReadingImportRows(
  estateId: string,
  batchId: string,
  page: number,
  outcome: ReadingImportOutcome | undefined,
  enabled: boolean
) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: [
      userId,
      "reading-imports",
      estateId,
      batchId,
      "rows",
      page,
      outcome,
    ],
    enabled: ready && enabled,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/readings/imports/{batchId}/rows",
        {
          signal,
          params: {
            path: { estateId, batchId },
            query: { page, size: 50, outcome },
          },
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

function useRefreshImports(estateId: string) {
  const client = useQueryClient();
  const { userId } = useEstateSession();
  return async () => {
    await Promise.all([
      client.invalidateQueries({
        queryKey: [userId, "reading-imports", estateId],
      }),
      client.invalidateQueries({
        queryKey: [userId, "estate-readings", estateId],
      }),
      client.invalidateQueries({
        queryKey: [userId, "reading-assets", estateId],
      }),
      client.invalidateQueries({
        queryKey: ["estates", userId, "assets", estateId],
      }),
    ]);
  };
}
/** The same list as `useReadingImportRows`, page after page, for phones. */
export function useReadingImportRowFeed(
  estateId: string,
  batchId: string,
  outcome: ReadingImportOutcome | undefined,
  enabled: boolean
) {
  const { userId, ready } = useEstateSession();
  return useInfiniteQuery({
    queryKey: [userId, "reading-imports", estateId, batchId, "feed", outcome],
    enabled: ready && enabled,
    retry: false,
    initialPageParam: 0,
    queryFn: async ({
      pageParam,
      signal,
    }): Promise<components["schemas"]["ReadingImportRowPage"]> => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/readings/imports/{batchId}/rows",
        {
          signal,
          params: {
            path: { estateId, batchId },
            query: { page: pageParam, size: 50, outcome },
          },
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    getNextPageParam: nextOffsetPage,
  });
}
export function useImportReadings(estateId: string) {
  const refresh = useRefreshImports(estateId);
  return useMutation({
    retry: false,
    mutationFn: async ({
      file,
      options,
      signal,
    }: {
      file: File;
      options: ReadingImportOptions;
      signal: AbortSignal;
    }) => {
      const body = new FormData();
      body.append("file", file);
      body.append(
        "options",
        new Blob([JSON.stringify(options)], { type: "application/json" })
      );
      const { data, error, response } = await api
        .POST("/estates/{estateId}/readings/imports", {
          signal,
          params: { path: { estateId } },
          body: body as never,
        })
        .catch((cause: unknown) => {
          throw new Error(
            "Import completion could not be confirmed. Check batch history, then retry with the same input.",
            { cause }
          );
        });
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: async (_data, variables) => {
      if (!variables.signal.aborted) {
        await refresh();
      }
    },
  });
}
export function useRevertReadingImport(estateId: string, batchId: string) {
  const refresh = useRefreshImports(estateId);
  return useMutation({
    retry: false,
    mutationFn: async ({
      reason,
      signal,
    }: {
      reason: string;
      signal: AbortSignal;
    }) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/readings/imports/{batchId}/revert",
        { signal, params: { path: { estateId, batchId } }, body: { reason } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: async (_data, variables) => {
      if (!variables.signal.aborted) {
        await refresh();
      }
    },
  });
}
export async function downloadImportReport(
  estateId: string,
  batchId: string,
  signal: AbortSignal
) {
  const { data, error, response } = await api.GET(
    "/estates/{estateId}/readings/imports/{batchId}/report",
    { signal, params: { path: { estateId, batchId } }, parseAs: "blob" }
  );
  if (error || !data) {
    throw estateError(error, response.status);
  }
  if (signal.aborted) {
    return;
  }
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = `reading-import-${batchId}-report.csv`;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

export function readingImportMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

/** On-screen names for a row's outcome; the enum stays in code. */
export const importOutcomeLabels: Record<ReadingImportOutcome, string> = {
  IMPORTED: "Imported",
  DUPLICATE: "Already imported",
  INVALID: "Has problems",
};

/** On-screen names for a batch's state. */
export const importStatusLabels: Record<ReadingImportBatch["status"], string> =
  {
    COMPLETED: "Imported",
    REVERTED: "Undone",
  };
