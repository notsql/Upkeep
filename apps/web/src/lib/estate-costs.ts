import type { components } from "@proj/api/schema";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";

export type CostliestAsset = components["schemas"]["CostliestAssetResponse"];
export type BudgetForecast = components["schemas"]["BudgetForecastResponse"];

const GROUP = /\B(?=(?:\d{3})+(?!\d))/gu;
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const DAY_MS = 86_400_000;

export function costliestAssetsQueryKey(
  userId: string | undefined,
  estateId: string
) {
  return ["estates", userId, "costs", estateId, "top-assets"] as const;
}

export function budgetForecastQueryKey(
  userId: string | undefined,
  estateId: string
) {
  return ["estates", userId, "costs", estateId, "forecast"] as const;
}

/** ID-34: up to five active assets by known maintenance spend. */
export function useCostliestAssets(estateId: string) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: costliestAssetsQueryKey(userId, estateId),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/costs/top-assets",
        { params: { path: { estateId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

/** ID-33: the projected maintenance cost of the next 12 months. */
export function useBudgetForecast(estateId: string) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: budgetForecastQueryKey(userId, estateId),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/costs/forecast",
        { params: { path: { estateId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

/** "12480.00" as "S$12,480.00", exactly: the amount is a decimal string, never a float. */
export function formatSgd(amount: string): string {
  const [whole, cents = "00"] = amount.split(".");
  return `S$${whole.replace(GROUP, ",")}.${cents}`;
}

/** "2026-11-08" as "8 Nov 2026"; `exclusive` shows the day before. */
export function formatDay(iso: string, exclusive = false): string {
  const time = Date.parse(`${iso}T00:00:00Z`) - (exclusive ? DAY_MS : 0);
  return DATE.format(time);
}
