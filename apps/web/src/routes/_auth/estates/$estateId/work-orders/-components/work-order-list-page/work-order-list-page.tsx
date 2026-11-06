import { Wrench } from "lucide-react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { LoadingState } from "@/components/states/loading-state";
import type { WorkOrderListSearch } from "@/lib/work-orders";
import { useWorkOrderListPage } from "@/routes/_auth/estates/$estateId/work-orders/-components/work-order-list-page/use-work-order-list-page";
import { WorkOrderFilters } from "@/routes/_auth/estates/$estateId/work-orders/-components/work-order-list-page/work-order-filters";
import { WorkOrderListResults } from "@/routes/_auth/estates/$estateId/work-orders/-components/work-order-list-page/work-order-list-results";

export function WorkOrderListPage({
  estateId,
  search,
  onChange,
}: {
  estateId: string;
  search: WorkOrderListSearch;
  onChange: (search: WorkOrderListSearch) => void;
}) {
  const page = useWorkOrderListPage(estateId, search, onChange);
  if (page.access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!page.access.canView) {
    return <p role="alert">Work orders are unavailable.</p>;
  }
  return (
    <PageLayout className="space-y-6">
      <ListPageHeader
        create={
          page.access.canCreate
            ? { params: { estateId }, to: "/estates/$estateId/work-orders/new" }
            : undefined
        }
        filters={{ activeCount: page.activeCount, ...page.panel.toggleProps }}
        icon={Wrench}
        title="Work orders"
      />
      <WorkOrderFilters
        filters={page.filters}
        key={JSON.stringify(page.filters)}
        onChange={page.changeFilters}
        {...page.panel.barProps}
      />
      <WorkOrderListResults
        canCreate={page.access.canCreate}
        canPrevious={page.canPrevious}
        descending={page.descending}
        estateId={estateId}
        filtered={page.filtered}
        onClear={page.clearFilters}
        onNext={page.next}
        onPrevious={page.previous}
        onRetry={page.retry}
        onSort={page.changeSort}
        orders={page.orders}
        sortBy={page.sortBy}
      />
    </PageLayout>
  );
}
