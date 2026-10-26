import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";

export type ResidentLocation =
  components["schemas"]["ResidentLocationResponse"];
export type IssueReport = components["schemas"]["IssueReportDetailResponse"];

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

export function useResidentContext() {
  const userId = useResidentId();
  return useQuery({
    queryKey: [userId, "resident-context"],
    enabled: !!userId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET("/resident/context");
      if (error || !data) {
        throw reportError(error, "Unable to load your estate assignment.");
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
      const { data, error } = await api.GET("/resident/locations", {
        params: { query: { estateId: estateId ?? "" } },
      });
      if (error || !data) {
        throw reportError(error, "Unable to load locations.");
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
    }: Omit<components["schemas"]["CreateIssueReportRequest"], "images"> & {
      images: File[];
    }) => {
      const body = new FormData();
      body.append("estateId", estateId);
      body.append("title", title);
      body.append("description", description);
      body.append("locationId", locationId);
      for (const image of images) {
        body.append("images", image);
      }
      // The generated schema describes multipart parts as strings; the client
      // accepts FormData at runtime and supplies its boundary automatically.
      const { data, error } = await api.POST("/resident/reports", {
        body: body as never,
      });
      if (error || !data) {
        throw reportError(
          error,
          "Unable to submit the report. Check My reports before trying again."
        );
      }
      return data;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [userId, "reports", "list"] });
    },
  });
}

export function useReportList(cursor?: string, estateId?: string) {
  const userId = useResidentId();
  return useQuery({
    queryKey: [userId, "reports", "list", estateId, cursor],
    enabled: !!userId,
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
        throw reportError(error, "Unable to load reports.");
      }
      return data;
    },
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
    enabled: !!userId && !!reportId && !!imageId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET(
        "/resident/reports/{reportId}/images/{imageId}",
        {
          params: { path: { reportId, imageId } },
          parseAs: "blob",
        }
      );
      if (error || !data) {
        throw reportError(error, "Unable to load report image.");
      }
      return data;
    },
  });
}
