import type { IntervalUnit } from "@/lib/service-intervals";

export type IntervalFilter = "ALL" | IntervalUnit | "NONE";

/** Each interval view's URL segment under /asset-categories/ (All is the index). */
export const INTERVAL_SLUGS: Record<Exclude<IntervalFilter, "ALL">, string> = {
  DAY: "days",
  MONTH: "months",
  YEAR: "years",
  NONE: "not-set",
};
