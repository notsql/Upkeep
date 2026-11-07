import { Tags } from "lucide-react";
import { type ReactNode, useCallback } from "react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { SubNav } from "@/components/page/sub-nav";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useEstateAssetCategories } from "@/lib/asset-categories";
import { INTERVAL_UNITS } from "@/lib/service-intervals";
import { CategorySummaryCards } from "@/routes/_auth/estates/$estateId/asset-categories/-components/asset-categories-layout/category-summary-cards";

import {
  INTERVAL_SLUGS,
  type IntervalFilter,
} from "@/routes/_auth/estates/$estateId/asset-categories/-components/interval-filter";

/**
 * The frame shared by every interval view: header, summary cards and the
 * service-interval SubNav. `children` (the current view) renders once the
 * categories have loaded.
 */
export function AssetCategoriesLayout({
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
        description="Silent-failure flags and service intervals"
        icon={Tags}
        title="Asset categories"
      />
      {categories.isPending ? (
        <LoadingState label="Loading asset categories…" variant="table" />
      ) : null}
      {categories.error ? (
        <ErrorState message={categories.error.message} onRetry={retry} />
      ) : null}
      {data ? (
        <section aria-label="Asset categories" className="grid gap-4">
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
                to: "/estates/$estateId/asset-categories",
              },
              ...(
                Object.keys(INTERVAL_SLUGS) as Exclude<IntervalFilter, "ALL">[]
              ).map((filter) => ({
                label:
                  filter === "NONE" ? "Not set" : INTERVAL_UNITS[filter].label,
                params: { estateId, interval: INTERVAL_SLUGS[filter] },
                to: "/estates/$estateId/asset-categories/$interval" as const,
              })),
            ]}
            label="Filter by service interval"
          />
          {children}
        </section>
      ) : null}
    </PageLayout>
  );
}
