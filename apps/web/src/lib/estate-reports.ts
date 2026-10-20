import type { components, paths } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppAccess, useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";

export type EstateReportFilters = Pick<
  NonNullable<
    paths["/estates/{estateId}/reports"]["get"]["parameters"]["query"]
  >,
  "blockId" | "minLevelPosition" | "maxLevelPosition"
>;

export type EstateReport = components["schemas"]["IssueReportDetailResponse"];

export class ReportRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function useEstateReportAccess(estateId: string) {
  const access = useAppAccess();
  const { userId, ready } = useAuthenticatedSession();
  const permission = access.data?.estates.find(
    (estate) => estate.estateId === estateId
  );
  const canView = ready && !access.isError && !!permission?.canViewFaultReports;
  return {
    userId,
    canView,
    canRelocate: canView && !!permission?.canRelocateFaultReports,
    pending: !ready || access.isPending,
  };
}

export function useEstateReportList(
  estateId: string,
  filters: EstateReportFilters,
  cursor?: string
) {
  const { userId, canView } = useEstateReportAccess(estateId);
  return useQuery({
    queryKey: [userId, "estate-reports", estateId, "list", filters, cursor, 20],
    enabled: canView,
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/reports",
        {
          params: {
            path: { estateId },
            query: { ...filters, cursor, limit: 20 },
          },
          signal,
        }
      );
      if (error || !data) {
        throw new ReportRequestError(
          error?.message ?? "Unable to load reports.",
          response?.status ?? 500
        );
      }
      return data;
    },
  });
}

export function useEstateReport(estateId: string, reportId: string) {
  const { userId, canView } = useEstateReportAccess(estateId);
  return useQuery({
    queryKey: [userId, "estate-reports", estateId, "detail", reportId],
    enabled: canView && !!reportId,
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/reports/{reportId}",
        {
          params: { path: { estateId, reportId } },
          signal,
        }
      );
      if (error || !data) {
        throw new ReportRequestError(
          error?.message ?? "Report not found or unavailable.",
          response?.status ?? 500
        );
      }
      return data;
    },
  });
}

export function useEstateReportLocations(estateId: string) {
  const { userId, canView } = useEstateReportAccess(estateId);
  return useQuery({
    queryKey: [userId, "estate-reports", estateId, "locations"],
    enabled: canView,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/locations",
        {
          params: { path: { estateId }, query: { includeInactive: true } },
          signal,
        }
      );
      if (error || !data) {
        throw new ReportRequestError(
          error?.message ?? "Unable to load locations.",
          response?.status ?? 500
        );
      }
      return data;
    },
  });
}

export function useEstateReportImage(
  estateId: string,
  reportId: string,
  imageId: string
) {
  const { userId, canView } = useEstateReportAccess(estateId);
  return useQuery({
    queryKey: [userId, "estate-reports", estateId, "image", reportId, imageId],
    enabled: canView && !!reportId && !!imageId,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/reports/{reportId}/images/{imageId}",
        {
          params: { path: { estateId, reportId, imageId } },
          parseAs: "blob",
          signal,
        }
      );
      if (error || !data) {
        throw new ReportRequestError(
          error?.message ?? "Unable to load an image.",
          response?.status ?? 500
        );
      }
      return data;
    },
  });
}

export function useRelocateEstateReport(estateId: string, reportId: string) {
  const { userId, canRelocate } = useEstateReportAccess(estateId);
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (
      body: components["schemas"]["RelocateReportRequest"]
    ) => {
      if (!canRelocate) {
        throw new ReportRequestError(
          "Location correction is unavailable.",
          403
        );
      }
      const { data, error, response } = await api.PATCH(
        "/estates/{estateId}/reports/{reportId}/location",
        {
          params: { path: { estateId, reportId } },
          body,
        }
      );
      if (error || !data) {
        throw new ReportRequestError(
          error?.message ?? "Unable to change location.",
          response?.status ?? 500
        );
      }
      return data;
    },
    onSuccess: async (data) => {
      const detail = [userId, "estate-reports", estateId, "detail", reportId];
      client.setQueryData(detail, data);
      await Promise.all([
        client.invalidateQueries({
          queryKey: [userId, "estate-reports", estateId, "list"],
        }),
        client.invalidateQueries({ queryKey: detail }),
        client.invalidateQueries({ queryKey: [userId, "reports"] }),
      ]);
    },
  });
}
