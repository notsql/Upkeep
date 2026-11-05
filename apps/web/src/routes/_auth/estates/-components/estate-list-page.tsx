import { Building2 } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { ListPageHeader } from "@/components/list-page-header";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
import { EstateCard } from "@/routes/_auth/estates/-components/estate-card";
import type { EstateDirectoryFilters } from "@/routes/_auth/estates/-components/estate-directory-filters";
import { EstateEmptyState } from "@/routes/_auth/estates/-components/estate-empty-state";
import { EstateFilterToolbar } from "@/routes/_auth/estates/-components/estate-filter-toolbar";
import { InvitationAcceptance } from "@/routes/_auth/estates/-components/invitation-acceptance";
import { PendingInvitations } from "@/routes/_auth/estates/-components/pending-invitations";
import { useEstateListPage } from "@/routes/_auth/estates/-components/use-estate-list-page";

export function EstateListPage({
  filters,
  onFiltersChange,
}: {
  filters: EstateDirectoryFilters;
  onFiltersChange: (filters: EstateDirectoryFilters) => void;
}) {
  const page = useEstateListPage(filters, onFiltersChange);
  const { estates, visible, activeCount, panel } = page;

  return (
    <PageLayout>
      <InvitationAcceptance />
      <PendingInvitations />
      <ListPageHeader
        create={{ to: "/estates/new" }}
        description="Estates you own or can access"
        filters={{ activeCount, ...panel.toggleProps }}
        icon={Building2}
        title="Estates"
      />
      <EstateFilterToolbar
        {...panel.barProps}
        access={page.access}
        activeCount={activeCount}
        changeAccess={page.changeAccess}
        changeSearch={page.changeSearch}
        changeStatus={page.changeStatus}
        clearFilters={page.clearFilters}
        count={page.count}
        filters={filters}
        showCount={Boolean(visible)}
        status={page.status}
      />
      {estates.isPending ? (
        <LoadingState label="Loading estates…" variant="cards" />
      ) : null}
      {estates.error ? (
        <ErrorState
          message={estates.error.message}
          onRetry={page.retry}
          retryLabel="Retry estates"
        />
      ) : null}
      {visible?.length === 0 ? (
        <EstateEmptyState
          emptyMessage={page.emptyMessage}
          filtersActive={page.filtersActive}
          onClear={page.clearFilters}
        />
      ) : null}
      {page.count > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible?.map((estate) => (
            <li key={estate.id}>
              <EstateCard estate={estate} />
            </li>
          ))}
        </ul>
      ) : null}
    </PageLayout>
  );
}
