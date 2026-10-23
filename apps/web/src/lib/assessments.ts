import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dashboardQueryKey } from "@/lib/dashboard";
import { estateError, useEstateSession } from "@/lib/estates";
import { estateFailureRiskQueryKey } from "@/lib/failure-risk";

export type Assessment = components["schemas"]["AssetAssessmentResponse"];
export type AssessmentInput =
  components["schemas"]["CreateAssetAssessmentRequest"];
export type AssetCondition = Assessment["condition"];

/** Every condition, in the order the form offers them (decision 0017). */
export const conditionLabel: Record<AssetCondition, string> = {
  GOOD: "Good",
  NEEDS_ATTENTION: "Needs attention",
  FAULTY: "Faulty",
};

/** Today in the browser's time zone, as the YYYY-MM-DD a date input uses. */
export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function assessmentsQueryKey(
  userId: string | undefined,
  estateId: string,
  assetId: string
) {
  return ["estates", userId, "assessments", estateId, assetId] as const;
}

/** Current condition first: the API orders by assessment date, then recording time. */
export function useAssessments(estateId: string, assetId: string) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: assessmentsQueryKey(userId, estateId, assetId),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/assessments",
        { params: { path: { estateId, assetId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useRecordAssessment(estateId: string, assetId: string) {
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AssessmentInput) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/assets/{assetId}/assessments",
        { params: { path: { estateId, assetId } }, body }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardQueryKey(userId) }),
        queryClient.invalidateQueries({
          queryKey: estateFailureRiskQueryKey(userId, estateId),
        }),
        queryClient.invalidateQueries({
          queryKey: assessmentsQueryKey(userId, estateId, assetId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["estates", userId, "assets", estateId],
        }),
      ]),
  });
}
