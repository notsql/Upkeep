import { Tags } from "lucide-react";
import { type ReactNode, useCallback } from "react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { SubNav } from "@/components/page/sub-nav";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useEstateAssetCategories } from "@/lib/asset-categories";
import { InspectionViews } from "@/routes/_auth/estates/$estateId/inspections/-components/inspection-views";
import { CategorySummaryCards } from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/check-schedules-layout/category-summary-cards";

import {
  INTERVAL_SLUGS,
  type IntervalFilter,
} from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/interval-filter";

const FILTER_LABELS: Record<Exclude<IntervalFilter, "ALL">, string> = {
  DAY: "Every few days",
  MONTH: "Every few months",
  YEAR: "Every few years",
  NONE: "No schedule",
};

/**
 * The frame shared by every interval view: header, summary cards and the
 * service-interval SubNav. `children` (the current view) renders once the
 * categories have loaded.
 */
export function CheckSchedulesLayout({
  estateId,
  children,
}: {
  estateId: string;
  children: ReactNode;
}) {
  const categories = useEstateAssetCategories(estateId);
  const retry = useCallback(() => categories.refetch(), [categories.refetch]);
  const { data } = categories;
  return (
    <PageLayout className="min-w-0">
      <ListPageHeader
        description="Choose which equipment gets regular checks, and how often."
        icon={Tags}
        title="Check schedules"
      />
      <p className="text-muted-foreground -mt-3 mb-4 text-sm">
        Turn on regular checks for equipment that can break without anyone
        noticing, like emergency lights.
      </p>
      <InspectionViews estateId={estateId} />
      {categories.isPending ? (
        <LoadingState label="Loading check schedules…" variant="table" />
      ) : null}
      {categories.error ? (
        <ErrorState message={categories.error.message} onRetry={retry} />
      ) : null}
      {data ? (
        <section aria-label="Check schedules" className="grid gap-4">
          <CategorySummaryCards
            categories={data.categories}
            estateId={estateId}
          />
          <SubNav
            items={[
              {
                exact: true,
                label: "All",
                params: { estateId },
                to: "/estates/$estateId/inspections/schedules",
              },
              ...(
                Object.keys(INTERVAL_SLUGS) as Exclude<IntervalFilter, "ALL">[]
              ).map((filter) => ({
                label: FILTER_LABELS[filter],
                params: { estateId, interval: INTERVAL_SLUGS[filter] },
                to: "/estates/$estateId/inspections/schedules/$interval" as const,
              })),
            ]}
            label="Filter by how often"
          />
          {children}
        </section>
      ) : null}
    </PageLayout>
  );
}
