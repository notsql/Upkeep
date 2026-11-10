import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleCheck,
  type LucideIcon,
  OctagonX,
  TriangleAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { refreshAssetHistory } from "@/lib/asset-history";
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

/**
 * Each condition's icon and colours, shared by the attention banner, the
 * Condition card and the history timeline. `tone` is the data-tone value.
 */
export const conditionStyle: Record<
  AssetCondition,
  {
    tone: string;
    icon: LucideIcon;
    /** Text colour for the condition label and icon. */
    text: string;
    /** Border and background for a banner. */
    surface: string;
    /** Background and ring for a timeline node. */
    node: string;
  }
> = {
  GOOD: {
    tone: "good",
    icon: CircleCheck,
    text: "text-success",
    surface: "border-success/40 bg-success/10 text-success dark:bg-success/20",
    node: "bg-success/10 ring-success/40 dark:bg-success/20",
  },
  NEEDS_ATTENTION: {
    tone: "needs-attention",
    icon: TriangleAlert,
    text: "text-warning",
    surface: "border-warning/40 bg-warning/10 text-warning dark:bg-warning/20",
    node: "bg-warning/10 ring-warning/40 dark:bg-warning/20",
  },
  FAULTY: {
    tone: "faulty",
    icon: OctagonX,
    text: "text-destructive",
    surface:
      "border-destructive/40 bg-destructive/10 text-destructive dark:bg-destructive/20",
    node: "bg-destructive/10 ring-destructive/40 dark:bg-destructive/20",
  },
};

/** The identity the server records anomaly-detection assessments under. */
export const ANOMALY_MODEL_USER_ID = "system:anomaly-model";

/** Who recorded an assessment, as shown to people. */
export function recorderName(assessment: Assessment): string {
  if (assessment.recordedByUserId === ANOMALY_MODEL_USER_ID) {
    return "Unusual readings";
  }
  return assessment.recordedByName ?? "Unknown user";
}

/** Whether anomaly detection, not a person, recorded the assessment. */
export function recordedByModel(assessment: Assessment): boolean {
  return assessment.recordedByUserId === ANOMALY_MODEL_USER_ID;
}

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
        refreshAssetHistory(queryClient, userId, estateId),
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
