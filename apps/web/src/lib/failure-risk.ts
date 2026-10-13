import type { components } from "@proj/api/schema";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";

export type FailureRisk = components["schemas"]["FailureRiskResponse"];

export function estateFailureRiskQueryKey(
  userId: string | undefined,
  estateId: string
) {
  return ["estates", userId, "failure-risk", estateId] as const;
}

export function assetFailureRiskQueryKey(
  userId: string | undefined,
  estateId: string,
  assetId: string
) {
  return [...estateFailureRiskQueryKey(userId, estateId), assetId] as const;
}

export function useEstateFailureRisk(estateId: string) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: estateFailureRiskQueryKey(userId, estateId),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/failure-risk",
        { params: { path: { estateId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useAssetFailureRisk(
  estateId: string,
  assetId: string,
  enabled = true
) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: assetFailureRiskQueryKey(userId, estateId, assetId),
    enabled: ready && enabled,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/failure-risk",
        { params: { path: { estateId, assetId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

type Timeframe = NonNullable<FailureRisk["recommendedTimeframe"]>;
type FlagReason = FailureRisk["flagReasons"][number];

export const timeframeLabel: Record<Timeframe, string> = {
  WITHIN_30_DAYS: "Within 30 days",
  WITHIN_60_DAYS: "Within 60 days",
  WITHIN_90_DAYS: "Within 90 days",
  BEYOND_90_DAYS: "Beyond 90 days",
};

export const flagReasonLabel: Record<FlagReason, string> = {
  CONDITION: "Condition",
  FAILURE_RISK: "Failure risk",
  END_OF_LIFE: "End of life",
};

/** Why a forecast has no probabilities, or null when it has them. */
export function noForecastReason(risk: FailureRisk): string | null {
  if (risk.basis === "NOT_SUPPORTED") {
    return "Not supported";
  }
  if ((risk.probability90Days ?? null) === null) {
    return "Not enough data";
  }
  return null;
}

export function formatProbability(value: number | null | undefined): string {
  return (value ?? null) === null ? "—" : `${Math.round((value ?? 0) * 100)}%`;
}
