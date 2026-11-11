import type { components } from "@proj/api/schema";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";
import { linkStaleTime, sendToStorage } from "@/lib/storage-upload";

export type ResidentLocation =
  components["schemas"]["ResidentLocationResponse"];
export type IssueReport = components["schemas"]["IssueReportDetailResponse"];
export type ReportEstate = components["schemas"]["EstateLabel"];

/** Shortest estate search the API accepts, after trimming. */
export const ESTATE_SEARCH_MIN_LENGTH = 2;
const ESTATE_CLOSED = "This estate is no longer taking reports.";

function useResidentId() {
  const { userId, ready } = useAuthenticatedSession();
  return ready ? userId : undefined;
}

function reportError(error: unknown, fallback: string): Error {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return new Error(error.message);
  }
  return new Error(fallback);
}

/** A 404 means the estate is unknown or deactivated: say so plainly. */
function estateError(
  error: unknown,
  response: Response | undefined,
  fallback: string
): Error {
  return response?.status === 404
    ? new Error(ESTATE_CLOSED)
    : reportError(error, fallback);
}

/** Active estates whose name contains the query; idle until it is long enough. */
export function useEstateSearch(query: string) {
  const userId = useResidentId();
  const q = query.trim();
  return useQuery({
    queryKey: [userId, "resident-estates", q],
    enabled: !!userId && q.length >= ESTATE_SEARCH_MIN_LENGTH,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET("/resident/estates", {
        params: { query: { q } },
      });
      if (error || !data) {
        throw reportError(error, "Couldn't search estates. Try again.");
      }
      return data;
    },
  });
}

export function useResidentContext() {
  const userId = useResidentId();
  return useQuery({
    queryKey: [userId, "resident-context"],
    enabled: !!userId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET("/resident/context");
      if (error || !data) {
        throw reportError(
          error,
          "Couldn't load your estates. Try again."
        );
      }
      return data;
    },
  });
}

export function useResidentLocations(estateId?: string) {
  const userId = useResidentId();
  return useQuery({
    queryKey: [userId, "resident-locations", estateId],
    enabled: !!userId && !!estateId,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/resident/locations", {
        params: { query: { estateId: estateId ?? "" } },
      });
      if (error || !data) {
        throw estateError(
          error,
          response,
          "Couldn't load locations. Try again."
        );
      }
      return data;
    },
  });
}

export function useCreateReport() {
  const userId = useResidentId();
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async ({
      estateId,
      title,
      description,
      locationId,
      images,
    }: Omit<
      components["schemas"]["CreateIssueReportRequest"],
      "imageKeys" | "reportId"
    > & {
      images: File[];
    }) => {
      // Each photo goes straight to storage; the first slot names the report.
      let reportId: string | undefined;
      const imageKeys: string[] = [];
      for (const image of images) {
        // biome-ignore lint/performance/noAwaitInLoops: later slots reuse the id the first slot returns
        const slot = await api.POST("/resident/reports/image-slots", {
          body: {
            estateId,
            ...(reportId ? { reportId } : {}),
            contentType: image.type,
            size: image.size,
          },
        });
        if (slot.error || !slot.data) {
          throw estateError(
            slot.error,
            slot.response,
            "Couldn't send a photo. Try again."
          );
        }
        reportId = slot.data.reportId ?? reportId;
        await sendToStorage(slot.data, image);
        imageKeys.push(slot.data.objectKey);
      }
      const { data, error, response } = await api.POST("/resident/reports", {
        body: {
          estateId,
          title,
          description,
          locationId,
          ...(reportId ? { reportId, imageKeys } : {}),
        },
      });
      if (error || !data) {
        throw estateError(
          error,
          response,
          "Couldn't submit the report. Check My reports before trying again."
        );
      }
      return data;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [userId, "reports", "list"] });
    },
  });
}

export function useReportList(
  cursor?: string,
  estateId?: string,
  enabled = true
) {
  const userId = useResidentId();
  return useQuery({
    queryKey: [userId, "reports", "list", estateId, cursor],
    enabled: !!userId && enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET("/resident/reports", {
        params: {
          query: {
            ...(cursor ? { cursor } : {}),
            ...(estateId ? { estateId } : {}),
          },
        },
      });
      if (error || !data) {
        throw reportError(error, "Couldn't load reports. Try again.");
      }
      return data;
    },
  });
}

/** The same list as `useReportList`, page after page, for phone widths. */
export function useReportFeed(estateId: string | undefined, enabled: boolean) {
  const userId = useResidentId();
  return useInfiniteQuery({
    queryKey: [userId, "reports", "list", estateId, "feed"],
    enabled: !!userId && enabled,
    retry: false,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({
      pageParam,
    }): Promise<components["schemas"]["ResidentReportPageResponse"]> => {
      const { data, error } = await api.GET("/resident/reports", {
        params: {
          query: {
            ...(pageParam ? { cursor: pageParam } : {}),
            ...(estateId ? { estateId } : {}),
          },
        },
      });
      if (error || !data) {
        throw reportError(error, "Couldn't load reports. Try again.");
      }
      return data;
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function useReport(reportId: string) {
  const userId = useResidentId();
  return useQuery({
    queryKey: [userId, "reports", reportId],
    enabled: !!userId && !!reportId,
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await api.GET("/resident/reports/{reportId}", {
        params: { path: { reportId } },
      });
      if (error || !data) {
        throw reportError(error, "Report not found or unavailable.");
      }
      return data;
    },
  });
}

export function useReportImage(reportId: string, imageId: string) {
  const userId = useResidentId();
  return useQuery({
    queryKey: [userId, "reports", reportId, "image", imageId],
    // Each link lasts five minutes; fetch a new one just before it expires.
    staleTime: (current) => linkStaleTime(current.state.data),
    refetchInterval: (current) => linkStaleTime(current.state.data) || false,
    enabled: !!userId && !!reportId && !!imageId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET(
        "/resident/reports/{reportId}/images/{imageId}",
        {
          params: { path: { reportId, imageId } },
        }
      );
      if (error || !data) {
        throw reportError(error, "Couldn't load report image. Try again.");
      }
      return data;
    },
  });
}
