import { ClipboardList } from "lucide-react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { LoadingState } from "@/components/states/loading-state";
import { EstateReportsLocations } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-page/estate-reports-locations";
import { EstateReportsResults } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-page/estate-reports-results";
import { useEstateReportsPage } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-page/use-estate-reports-page";
import type { EstateReportsSearch } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-search";
import { RoutingStateFilter } from "@/routes/_auth/estates/$estateId/reports/-components/routing-state-filter";

export function EstateReportsPage({
  estateId,
  search,
  onSearch,
}: {
  estateId: string;
  search: EstateReportsSearch;
  onSearch: (search: EstateReportsSearch) => void;
}) {
  const page = useEstateReportsPage(estateId, search, onSearch);
  const { access, activeCount, panel } = page;
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canView) {
    return <p role="alert">Fault reports are unavailable.</p>;
  }
  return (
    <PageLayout className="space-y-4">
      <ListPageHeader
        filters={{ activeCount, ...panel.toggleProps }}
        icon={ClipboardList}
        title="Fault reports"
      />
      <EstateReportsLocations
        barProps={panel.barProps}
        filters={page.filters}
        locations={page.locations}
        onChange={page.filter}
        onRetry={page.retryLocations}
      />
      <RoutingStateFilter
        onChange={page.filterRouting}
        value={page.routingState}
      />
      <EstateReportsResults
        cursor={search.cursor}
        estateId={estateId}
        filtered={page.filtered}
        onClear={page.clearFilters}
        onFirst={page.first}
        onNext={page.next}
        onRetry={page.retry}
        reports={page.reports}
      />
    </PageLayout>
  );
}
