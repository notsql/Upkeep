import type { components } from "@proj/api/schema";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";

export type DashboardSummary =
  components["schemas"]["DashboardSummaryResponse"];

export function dashboardQueryKey(userId: string | undefined) {
  return ["estates", userId, "dashboard"] as const;
}

export function useDashboardSummary() {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: dashboardQueryKey(userId),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/dashboard/summary");
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}
