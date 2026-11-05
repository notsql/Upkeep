import { ClipboardList } from "lucide-react";
import { ListPageHeader } from "@/components/list-page-header";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
import { EstateReportsLocations } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-locations";
import { EstateReportsResults } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-results";
import type { EstateReportsSearch } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-search";
import { useEstateReportsPage } from "@/routes/_auth/estates/$estateId/reports/-components/use-estate-reports-page";

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
